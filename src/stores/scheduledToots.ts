import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { MastodonStatus, ScheduledToot } from '../types/mastodon';
import { useMastodonApi } from '../composables/useMastodonApi';
import { isOnlyScheduleChange } from '../utils/isOnlyScheduleChange';

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
   * @throws {Error} If the original no longer exists, or rescheduling/creating fails (the original is kept).
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
        // If the original was published meanwhile, recreating it would post the toot twice.
        if (!(await api.scheduledTootExists(original.id))) {
          throw new Error('This toot has already been published or deleted, so it can no longer be edited.');
        }
        await api.scheduleToot(updated, idempotencyKey);
        try {
          await api.deleteScheduledToot(original.id);
        } catch (err) {
          console.error('Error deleting the previous version of an edited toot:', err);
          previousVersionRemoved = false;
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
