import { defineStore } from 'pinia';
import type { MastodonStatus, ScheduledToot } from '../types/mastodon';
import { useMastodonApi } from '../composables/useMastodonApi';

export const useScheduledTootsStore = defineStore('scheduledToots', {
  state: () => ({
    toots: [] as MastodonStatus[],
    isLoading: false,
    error: '',
    editingToot: null as MastodonStatus | null,
  }),
  getters: {
    count: (state) => state.toots.length,
  },
  actions: {
    setToots(toots: MastodonStatus[]) {
      this.toots = toots;
    },
    setLoading(loading: boolean) {
      this.isLoading = loading;
    },
    setError(error: string) {
      this.error = error;
    },
    setEditingToot(toot: MastodonStatus | null) {
      this.editingToot = toot;
    },
    async fetchScheduledToots() {
      try {
        this.setLoading(true);
        this.setError('');
        const api = useMastodonApi();
        const toots = await api.getScheduledToots();
        this.setToots(toots);
      } catch (err) {
        console.error('Error fetching scheduled toots:', err);
        this.setError(err instanceof Error ? err.message : 'Failed to fetch scheduled toots');
      } finally {
        this.setLoading(false);
      }
    },
    async updateToot(id: string, updatedToot: ScheduledToot) {
      try {
        this.setLoading(true);
        this.setError('');
        const api = useMastodonApi();
        
        // First, delete the existing toot
        await api.deleteScheduledToot(id);
        
        // Then create a new one with the updated content
        await api.scheduleToot(updatedToot);
        
        // Refresh the list and clear edit mode
        await this.fetchScheduledToots();
        this.setEditingToot(null);
      } catch (err) {
        console.error('Error updating toot:', err);
        this.setError(err instanceof Error ? err.message : 'Failed to update toot');
        throw err;
      } finally {
        this.setLoading(false);
      }
    },
  },
}); 