import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import type { MastodonStatus, ScheduledToot } from '../types/mastodon';
import { useMastodonApi } from '../composables/useMastodonApi';
import { useAuthStore } from './auth';
import { isOnlyScheduleChange } from '../utils/isOnlyScheduleChange';
import { logError } from '../utils/logError';

/** A change refused because another one is still being saved: nothing was sent. */
export class BusyError extends Error {
  constructor() {
    super('Another change is still being saved. Please try again in a moment.');
    this.name = 'BusyError';
  }
}

/** Mastodon refuses scheduling less than 5 minutes ahead; past that point the original may publish mid-edit. */
const EDIT_LOCK_MS = 5 * 60 * 1000;

/** What can be in progress: on one scheduled toot (only its card shows it), or the creation of a new one. */
export type PendingAction = 'delete' | 'update' | 'create';

/** Pending id while a new toot is created: no card has it, so none shows progress, yet all are disabled. */
const NEW_TOOT_PENDING_ID = 'new';

/** Outcome of an edit, so the UI can warn when a stale copy is left behind. */
export interface UpdateTootResult {
  /** False when the new version was scheduled but the previous one could not be deleted. */
  previousVersionRemoved: boolean;
}

function getTimestamp(toot: MastodonStatus): number {
  if (!toot.scheduled_at) return 0;
  const time = new Date(toot.scheduled_at).getTime();
  return isNaN(time) ? 0 : time;
}

/**
 * Creates a Pinia store for the user's scheduled toots.
 * @returns {Object} The scheduled toots store with state and actions.
 */
export const useScheduledTootsStore = defineStore('scheduledToots', () => {
  const toots = ref<MastodonStatus[]>([]);
  const isLoading = ref(false);
  const error = ref('');
  const editingToot = ref<MastodonStatus | null>(null);
  /** The toot being deleted or updated, and what is being done to it. */
  const pendingId = ref<string | null>(null);
  const pendingAction = ref<PendingAction | null>(null);
  const auth = useAuthStore();

  /** Number of the latest list request: an earlier one that answers late must not overwrite it. */
  let fetchSeq = 0;

  const count = computed(() => toots.value.length);
  const sortedToots = computed(() => [...toots.value].sort((a, b) => getTimestamp(a) - getTimestamp(b)));

  function setToots(value: MastodonStatus[]): void {
    toots.value = value;
  }

  function setError(value: string): void {
    error.value = value;
  }

  function setEditingToot(toot: MastodonStatus | null): void {
    editingToot.value = toot;
  }

  function startPending(id: string, action: PendingAction): void {
    pendingId.value = id;
    pendingAction.value = action;
  }

  /** Clears this toot's progress, unless an operation on another toot started meanwhile. */
  function finishPending(id: string): void {
    if (pendingId.value !== id) return;
    pendingId.value = null;
    pendingAction.value = null;
  }

  /**
   * Loads all scheduled toots from the instance.
   */
  async function fetchScheduledToots(): Promise<void> {
    // A list loaded for a previous session must not overwrite the current one.
    const token = auth.accessToken;
    // Reloads can overlap (a deletion and an edit, say): only the latest one may update the list.
    const seq = ++fetchSeq;
    const isStale = () => seq !== fetchSeq || auth.accessToken !== token;
    try {
      isLoading.value = true;
      setError('');
      const api = useMastodonApi();
      const loaded = await api.getScheduledToots();
      if (isStale()) return;
      setToots(loaded);
    } catch (err) {
      logError('Error fetching scheduled toots', err);
      if (isStale()) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch scheduled toots');
    } finally {
      // The latest request owns the loading state.
      if (seq === fetchSeq) isLoading.value = false;
    }
  }

  /**
   * Deletes a scheduled toot, then reloads the list. Only that toot is marked as in progress.
   * Refused while another operation is pending: overlapping changes could bring a deleted toot back.
   * @param {string} id - The ID of the scheduled toot.
   * @returns {Promise<boolean>} True once deleted; false if refused or failed (a failure is in `error`).
   */
  async function deleteToot(id: string): Promise<boolean> {
    if (pendingId.value !== null) return false;
    const token = auth.accessToken;
    startPending(id, 'delete');
    try {
      setError('');
      await useMastodonApi().deleteScheduledToot(id);
      // The composer must not keep editing, and later re-create, a toot that no longer exists.
      // Unless another session took over: its edit is another account's toot.
      if (auth.accessToken === token && editingToot.value?.id === id) setEditingToot(null);
      await fetchScheduledToots();
      return true;
    } catch (err) {
      // Another session took over meanwhile: this failure is not its concern.
      if (auth.accessToken !== token) return false;
      setError(err instanceof Error ? err.message : 'Failed to delete toot');
      return false;
    } finally {
      finishPending(id);
    }
  }

  /**
   * Schedules a new toot, then reloads the list. Holds the pending slot meanwhile, so no
   * toot can be edited or deleted while it is being sent.
   * Failures are not put in `error`: the composer shows them.
   * @param {ScheduledToot} toot - The payload built from the form.
   * @param {string} idempotencyKey - The draft's idempotency key.
   * @throws {BusyError} If another change is still being saved (nothing is sent).
   * @throws {Error} If scheduling fails.
   */
  async function createToot(toot: ScheduledToot, idempotencyKey: string): Promise<void> {
    if (pendingId.value !== null) throw new BusyError();
    try {
      startPending(NEW_TOOT_PENDING_ID, 'create');
      await useMastodonApi().scheduleToot(toot, idempotencyKey);
      // A reload started for a previous session discards itself.
      await fetchScheduledToots();
    } finally {
      // Another session took over meanwhile: its own operation, if any, keeps its slot.
      finishPending(NEW_TOOT_PENDING_ID);
    }
  }

  /**
   * Applies an edit to a scheduled toot without ever losing the original.
   * A date-only change is rescheduled in place. Any other change creates the new
   * version first and deletes the original only once the new one exists.
   * @param {MastodonStatus} original - The scheduled toot being edited.
   * @param {ScheduledToot} updated - The payload built from the edited form.
   * @param {string} idempotencyKey - The draft's idempotency key.
   * @returns {Promise<UpdateTootResult>} Whether the previous version was removed.
   * @throws {Error} If another change is still being saved (nothing is sent), the original is due within 5 minutes or no longer exists, or rescheduling/creating fails (the original is kept).
   */
  async function updateToot(
    original: MastodonStatus,
    updated: ScheduledToot,
    idempotencyKey: string,
  ): Promise<UpdateTootResult> {
    // Thrown before anything starts, and not put in `error`: the list stays as it is, the composer says why.
    if (pendingId.value !== null) throw new BusyError();
    const token = auth.accessToken;
    try {
      startPending(original.id, 'update');
      setError('');
      const api = useMastodonApi();
      let previousVersionRemoved = true;

      if (updated.scheduled_at && isOnlyScheduleChange(original, updated)) {
        await api.rescheduleToot(original.id, updated.scheduled_at);
      } else {
        const originalTime = original.scheduled_at ? new Date(original.scheduled_at).getTime() : NaN;
        if (!(originalTime - Date.now() > EDIT_LOCK_MS)) {
          throw new Error('This toot is about to be published and can no longer be edited.');
        }
        // If the original was published meanwhile, recreating it would post the toot twice.
        if (!(await api.scheduledTootExists(original.id))) {
          throw new Error('This toot has already been published or deleted, so it can no longer be edited.');
        }
        await api.scheduleToot(updated, idempotencyKey);
        try {
          await api.deleteScheduledToot(original.id);
        } catch (err) {
          logError('Error deleting the previous version of an edited toot', err);
          // The delete may have succeeded with its response lost: only warn if it is really still there.
          previousVersionRemoved = !(await api.scheduledTootExists(original.id).catch(() => true));
        }
      }

      await fetchScheduledToots();
      // Another session took over meanwhile: its edit, if any, is not this one.
      if (auth.accessToken === token) setEditingToot(null);
      return { previousVersionRemoved };
    } catch (err) {
      // Not put in `error`: the composer shows it, and the reload it starts would clear it at once.
      logError('Error updating toot', err);
      throw err;
    } finally {
      finishPending(original.id);
    }
  }

  // A different session (logout, sign-in, account switch in another tab) must never see,
  // or re-submit, the previous account's toots.
  watch(() => auth.accessToken, (token, previous) => {
    if (token === previous) return;
    setToots([]);
    setEditingToot(null);
    pendingId.value = null;
    pendingAction.value = null;
    if (token && previous) void fetchScheduledToots();
  });

  return {
    toots,
    isLoading,
    error,
    editingToot,
    pendingId,
    pendingAction,
    count,
    sortedToots,
    setToots,
    setError,
    setEditingToot,
    fetchScheduledToots,
    deleteToot,
    createToot,
    updateToot,
  };
});
