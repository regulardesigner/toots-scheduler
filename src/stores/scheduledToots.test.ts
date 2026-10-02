import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { MastodonStatus, ScheduledToot } from '../types/mastodon';

const api = vi.hoisted(() => ({
  getScheduledToots: vi.fn(),
  scheduleToot: vi.fn(),
  rescheduleToot: vi.fn(),
  deleteScheduledToot: vi.fn(),
  scheduledTootExists: vi.fn(),
}));

vi.mock('../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));

import { useScheduledTootsStore } from './scheduledToots';

const original: MastodonStatus = {
  id: '42',
  content: '',
  created_at: '',
  visibility: 'public',
  url: '',
  media_attachments: [],
  scheduled_at: '2030-01-01T12:00:00.000Z',
  params: { text: 'Hello', visibility: 'public', language: 'en', sensitive: false, spoiler_text: '', media_ids: [], poll: null },
};

function makeUpdated(overrides: Partial<ScheduledToot> = {}): ScheduledToot {
  return {
    status: 'Hello',
    scheduled_at: '2030-01-02T08:00:00.000Z',
    visibility: 'public',
    language: 'en',
    sensitive: false,
    media_ids: [],
    ...overrides,
  };
}

describe('scheduledToots store', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setActivePinia(createPinia());
    api.getScheduledToots.mockResolvedValue([]);
    api.scheduledTootExists.mockResolvedValue(true);
  });

  it('sorts toots by scheduled date', () => {
    const store = useScheduledTootsStore();
    store.setToots([
      { ...original, id: 'late', scheduled_at: '2030-03-01T00:00:00.000Z' },
      { ...original, id: 'early', scheduled_at: '2030-01-01T00:00:00.000Z' },
    ]);
    expect(store.sortedToots.map(t => t.id)).toEqual(['early', 'late']);
    expect(store.count).toBe(2);
  });

  describe('updateToot', () => {
    it('reschedules in place when only the date changed', async () => {
      const store = useScheduledTootsStore();
      store.setEditingToot(original);

      const result = await store.updateToot(original, makeUpdated(), 'key-1');

      expect(api.rescheduleToot).toHaveBeenCalledWith('42', '2030-01-02T08:00:00.000Z');
      expect(api.scheduleToot).not.toHaveBeenCalled();
      expect(api.deleteScheduledToot).not.toHaveBeenCalled();
      expect(result).toEqual({ previousVersionRemoved: true });
      expect(store.editingToot).toBeNull();
      expect(store.error).toBe('');
    });

    it('creates the new version before deleting the original', async () => {
      const store = useScheduledTootsStore();
      const calls: string[] = [];
      api.scheduleToot.mockImplementation(async () => { calls.push('create'); });
      api.deleteScheduledToot.mockImplementation(async () => { calls.push('delete'); });

      await store.updateToot(original, makeUpdated({ status: 'Hello again' }), 'key-1');

      expect(calls).toEqual(['create', 'delete']);
      expect(api.scheduleToot).toHaveBeenCalledWith(expect.objectContaining({ status: 'Hello again' }), 'key-1');
      expect(api.deleteScheduledToot).toHaveBeenCalledWith('42');
      expect(api.scheduledTootExists).toHaveBeenCalledWith('42');
    });

    it('keeps the original when creating the new version fails', async () => {
      const store = useScheduledTootsStore();
      store.setEditingToot(original);
      api.scheduleToot.mockRejectedValue(new Error('Validation failed'));

      await expect(store.updateToot(original, makeUpdated({ status: 'Changed' }), 'key-1')).rejects.toThrow('Validation failed');

      expect(api.deleteScheduledToot).not.toHaveBeenCalled();
      expect(store.error).toBe('Validation failed');
      expect(store.editingToot).toEqual(original);
    });

    it('reports a stale copy when deleting the original fails after creation', async () => {
      const store = useScheduledTootsStore();
      api.deleteScheduledToot.mockRejectedValue(new Error('Network Error'));

      const result = await store.updateToot(original, makeUpdated({ status: 'Changed' }), 'key-1');

      expect(result).toEqual({ previousVersionRemoved: false });
      expect(api.getScheduledToots).toHaveBeenCalled();
      expect(store.error).toBe('');
      expect(store.isLoading).toBe(false);
    });

    it('aborts without creating anything when the original was already published or deleted', async () => {
      const store = useScheduledTootsStore();
      store.setEditingToot(original);
      api.scheduledTootExists.mockResolvedValue(false);

      await expect(store.updateToot(original, makeUpdated({ status: 'Changed' }), 'key-1'))
        .rejects.toThrow('This toot has already been published or deleted, so it can no longer be edited.');

      expect(api.scheduleToot).not.toHaveBeenCalled();
      expect(api.deleteScheduledToot).not.toHaveBeenCalled();
      expect(store.editingToot).toEqual(original);
    });

    it('keeps everything as is when rescheduling fails', async () => {
      const store = useScheduledTootsStore();
      store.setEditingToot(original);
      api.rescheduleToot.mockRejectedValue(new Error('The scheduled date must be in the future'));

      await expect(store.updateToot(original, makeUpdated(), 'key-1')).rejects.toThrow('The scheduled date must be in the future');

      expect(api.scheduleToot).not.toHaveBeenCalled();
      expect(api.deleteScheduledToot).not.toHaveBeenCalled();
      expect(store.editingToot).toEqual(original);
      expect(store.isLoading).toBe(false);
    });
  });
});
