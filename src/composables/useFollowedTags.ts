import { ref } from 'vue';
import { useMastodonApi } from './useMastodonApi';
import type { Tag } from '../types/mastodon';

export function useFollowedTags() {
  const api = useMastodonApi();
  const followedTags = ref<Tag[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchFollowedTags() {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.get<Tag[]>('/api/v1/followed_tags');
      followedTags.value = response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch followed tags';
      console.error('Error fetching followed tags:', err);
    } finally {
      isLoading.value = false;
    }
  }

  return {
    followedTags,
    isLoading,
    error,
    fetchFollowedTags,
  };
} 