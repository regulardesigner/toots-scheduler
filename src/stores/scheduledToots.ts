import { defineStore } from 'pinia';
import type { MastodonStatus } from '../types/mastodon';
import { useMastodonApi } from '../composables/useMastodonApi';

export const useScheduledTootsStore = defineStore('scheduledToots', {
  state: () => ({
    toots: [] as MastodonStatus[],
    isLoading: false,
    error: '',
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
  },
}); 