import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import type { MastodonStatus, ScheduledToot } from '../types/mastodon';
import { useMastodonApi } from '../composables/useMastodonApi';
import { useAuthStore } from './auth';
import { isOnlyScheduleChange } from '../utils/isOnlyScheduleChange';

/** Mastodon refuses scheduling less than 5 minutes ahead; past that point the original may publish mid-edit. */
const EDIT_LOCK_MS = 5 * 60 * 1000;

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
  const auth = useAuthStore();

  const count = computed(() => toots.value.length);
  const sortedToots = computed(() => [...toots.value].sort((a, b) => getTimestamp(a) - getTimestamp(b)));

  function setToots(value: MastodonStatus[]): void {
    toots.value = value;
  }

  function setLoading(value: boolean): void {
    isLoading.value = value;
  }

  function setError(value: string): void {
    error.value = value;
  }

  function setEditingToot(toot: MastodonStatus | null): void {
    editingToot.value = toot;
  }

  /**
   * Loads all scheduled toots from the instance.
   */
  async function fetchScheduledToots(): Promise<void> {
    try {
      setLoading(true);
      setError('');
      const api = useMastodonApi();
      setToots(await api.getScheduledToots());
    } catch (err) {
      console.error('Error fetching scheduled toots:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch scheduled toots');
    } finally {
      setLoading(false);
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
   * @throws {Error} If the original is due within 5 minutes or no longer exists, or rescheduling/creating fails (the original is kept).
   */
  async function updateToot(
    original: MastodonStatus,
    updated: ScheduledToot,
    idempotencyKey: string,
  ): Promise<UpdateTootResult> {
    try {
      setLoading(true);
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
          console.error('Error deleting the previous version of an edited toot:', err);
          // The delete may have succeeded with its response lost: only warn if it is really still there.
          previousVersionRemoved = !(await api.scheduledTootExists(original.id).catch(() => true));
        }
      }

      await fetchScheduledToots();
      setEditingToot(null);
      return { previousVersionRemoved };
    } catch (err) {
      console.error('Error updating toot:', err);
      setError(err instanceof Error ? err.message : 'Failed to update toot');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  // A different session (logout, sign-in, account switch in another tab) must never see,
  // or re-submit, the previous account's toots.
  watch(() => auth.accessToken, (token, previous) => {
    if (token === previous) return;
    setToots([]);
    setEditingToot(null);
    if (token && previous) void fetchScheduledToots();
  });

  return {
    toots,
    isLoading,
    error,
    editingToot,
    count,
    sortedToots,
    setToots,
    setLoading,
    setError,
    setEditingToot,
    fetchScheduledToots,
    updateToot,
  };
});
