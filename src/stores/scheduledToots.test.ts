import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import type { MastodonStatus, ScheduledToot } from '../types/mastodon';

const api = vi.hoisted(() => ({
  getScheduledToots: vi.fn(),
  scheduleToot: vi.fn(),
  rescheduleToot: vi.fn(),
  deleteScheduledToot: vi.fn(),
  scheduledTootExists: vi.fn(),
}));

vi.mock('../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn().mockResolvedValue({}), isAxiosError: () => false } }));

import { useScheduledTootsStore, BusyError } from './scheduledToots';
import { useAuthStore } from './auth';

const original: MastodonStatus = {
  id: '42',
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
    localStorage.clear();
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

  describe('deleteToot', () => {
    it('marks only the deleted toot as in progress, then reloads the list', async () => {
      const store = useScheduledTootsStore();
      let finish!: () => void;
      api.deleteScheduledToot.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));

      const deleting = store.deleteToot('42');
      expect(store.pendingId).toBe('42');
      expect(store.pendingAction).toBe('delete');
      expect(store.isLoading).toBe(false);

      finish();
      expect(await deleting).toBe(true);
      expect(api.getScheduledToots).toHaveBeenCalled();
      expect(store.pendingId).toBeNull();
      expect(store.pendingAction).toBeNull();
    });

    it('reports a failed deletion', async () => {
      const store = useScheduledTootsStore();
      api.deleteScheduledToot.mockRejectedValue(new Error('Record not found'));

      expect(await store.deleteToot('42')).toBe(false);
      expect(store.error).toBe('Record not found');
      expect(store.pendingId).toBeNull();
    });

    it('refuses a second deletion while one is in progress', async () => {
      const store = useScheduledTootsStore();
      let finish!: () => void;
      api.deleteScheduledToot.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));

      const first = store.deleteToot('a');
      expect(await store.deleteToot('b')).toBe(false);
      expect(api.deleteScheduledToot).toHaveBeenCalledTimes(1);
      expect(store.pendingId).toBe('a');

      finish();
      expect(await first).toBe(true);
      expect(store.pendingId).toBeNull();
      expect(store.pendingAction).toBeNull();
    });

    it('refuses an update while a deletion is in progress, without touching the list error', async () => {
      const store = useScheduledTootsStore();
      let finish!: () => void;
      api.deleteScheduledToot.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));

      const deleting = store.deleteToot('a');
      const refusal = store.updateToot(original, makeUpdated(), 'key-1');
      await expect(refusal).rejects.toBeInstanceOf(BusyError);
      await expect(refusal).rejects.toThrow('Another change is still being saved');
      expect(api.rescheduleToot).not.toHaveBeenCalled();
      expect(store.error).toBe('');
      expect(store.pendingId).toBe('a');

      finish();
      await deleting;
    });

    it('leaves edit mode when the toot being edited is deleted', async () => {
      const store = useScheduledTootsStore();
      api.deleteScheduledToot.mockResolvedValue(undefined);
      store.setEditingToot(original);

      await store.deleteToot('other');
      expect(store.editingToot).toEqual(original);

      await store.deleteToot('42');
      expect(store.editingToot).toBeNull();
    });
  });

  describe('createToot', () => {
    it('schedules the toot with its idempotency key, then reloads the list', async () => {
      const store = useScheduledTootsStore();
      api.scheduleToot.mockResolvedValue({});

      await store.createToot(makeUpdated(), 'key-1');

      expect(api.scheduleToot).toHaveBeenCalledWith(makeUpdated(), 'key-1');
      expect(api.getScheduledToots).toHaveBeenCalled();
      expect(store.pendingId).toBeNull();
      expect(store.pendingAction).toBeNull();
    });

    it('holds the pending slot while the toot is created, without naming any toot', async () => {
      const store = useScheduledTootsStore();
      store.setToots([original]);
      let finish!: () => void;
      api.scheduleToot.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));

      const creating = store.createToot(makeUpdated(), 'key-1');
      expect(store.pendingId).not.toBeNull();
      expect(store.pendingAction).toBe('create');
      expect(store.toots.some(toot => toot.id === store.pendingId)).toBe(false);

      finish();
      await creating;
      expect(store.pendingId).toBeNull();
      expect(store.pendingAction).toBeNull();
    });

    it('refuses deletions and updates while a toot is being created', async () => {
      const store = useScheduledTootsStore();
      let finish!: () => void;
      api.scheduleToot.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));

      const creating = store.createToot(makeUpdated(), 'key-1');
      expect(await store.deleteToot('42')).toBe(false);
      await expect(store.updateToot(original, makeUpdated(), 'key-2')).rejects.toBeInstanceOf(BusyError);
      expect(api.deleteScheduledToot).not.toHaveBeenCalled();
      expect(api.rescheduleToot).not.toHaveBeenCalled();

      finish();
      await creating;
    });

    it('is refused, without sending anything, while another change is running', async () => {
      const store = useScheduledTootsStore();
      let finish!: () => void;
      api.deleteScheduledToot.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));

      const deleting = store.deleteToot('42');
      await expect(store.createToot(makeUpdated(), 'key-1')).rejects.toBeInstanceOf(BusyError);
      expect(api.scheduleToot).not.toHaveBeenCalled();
      expect(store.pendingId).toBe('42');

      finish();
      await deleting;
    });

    it('rethrows a failure without putting it in the list error, and frees the slot', async () => {
      const store = useScheduledTootsStore();
      api.scheduleToot.mockRejectedValue(new Error('Validation failed'));

      await expect(store.createToot(makeUpdated(), 'key-1')).rejects.toThrow('Validation failed');

      expect(store.error).toBe('');
      expect(store.pendingId).toBeNull();
    });

    it('does not free the slot of the next session when a create of the previous one finishes late', async () => {
      const auth = useAuthStore();
      auth.completeLogin({ instance: 'https://masto.example', clientId: 'id', clientSecret: 'secret', accessToken: 'token-a' });
      const store = useScheduledTootsStore();
      await nextTick();
      let finish!: () => void;
      api.scheduleToot.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));

      const creating = store.createToot(makeUpdated(), 'key-1');
      auth.completeLogin({ instance: 'https://masto.example', clientId: 'id', clientSecret: 'secret', accessToken: 'token-b' });
      await nextTick();
      expect(store.pendingId).toBeNull();
      let finishDelete!: () => void;
      api.deleteScheduledToot.mockReturnValueOnce(new Promise<void>(resolve => { finishDelete = resolve; }));
      const deleting = store.deleteToot('42');

      finish();
      await creating;
      expect(store.pendingId).toBe('42');

      finishDelete();
      await deleting;
    });
  });

  describe('updateToot', () => {
    it('marks the edited toot as in progress while it is updated', async () => {
      const store = useScheduledTootsStore();
      let finish!: () => void;
      api.rescheduleToot.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));

      const updating = store.updateToot(original, makeUpdated(), 'key-1');
      expect(store.pendingId).toBe('42');
      expect(store.pendingAction).toBe('update');

      finish();
      await updating;
      expect(store.pendingId).toBeNull();
    });

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

    it('keeps the original when creating the new version fails, leaving the failure to the composer', async () => {
      const store = useScheduledTootsStore();
      store.setEditingToot(original);
      api.scheduleToot.mockRejectedValue(new Error('Validation failed'));

      await expect(store.updateToot(original, makeUpdated({ status: 'Changed' }), 'key-1')).rejects.toThrow('Validation failed');

      expect(api.deleteScheduledToot).not.toHaveBeenCalled();
      expect(store.error).toBe('');
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

    it('refuses a content edit when the original is due within 5 minutes', async () => {
      const store = useScheduledTootsStore();
      const soon = { ...original, scheduled_at: new Date(Date.now() + 2 * 60 * 1000).toISOString() };

      await expect(store.updateToot(soon, makeUpdated({ status: 'Changed' }), 'key-1'))
        .rejects.toThrow('This toot is about to be published and can no longer be edited.');

      expect(api.scheduledTootExists).not.toHaveBeenCalled();
      expect(api.scheduleToot).not.toHaveBeenCalled();
      expect(api.deleteScheduledToot).not.toHaveBeenCalled();
    });

    it('treats the previous version as removed when it is gone after a failed delete', async () => {
      const store = useScheduledTootsStore();
      api.scheduledTootExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      api.deleteScheduledToot.mockRejectedValue(new Error('Network Error'));

      const result = await store.updateToot(original, makeUpdated({ status: 'Changed' }), 'key-1');

      expect(result).toEqual({ previousVersionRemoved: true });
      expect(api.scheduledTootExists).toHaveBeenCalledTimes(2);
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

  describe('fetchScheduledToots', () => {
    it('keeps the latest list when an earlier reload answers last', async () => {
      const store = useScheduledTootsStore();
      let answerFirst!: (toots: MastodonStatus[]) => void;
      let answerSecond!: (toots: MastodonStatus[]) => void;
      api.getScheduledToots
        .mockReturnValueOnce(new Promise(resolve => { answerFirst = resolve; }))
        .mockReturnValueOnce(new Promise(resolve => { answerSecond = resolve; }));
      const stale = { ...original, id: 'deleted' };

      const first = store.fetchScheduledToots();
      const second = store.fetchScheduledToots();
      answerSecond([original]);
      await second;
      expect(store.isLoading).toBe(false);
      answerFirst([original, stale]);
      await first;

      expect(store.toots).toEqual([original]);
      expect(store.isLoading).toBe(false);
    });

    it('ignores the error of an earlier reload once a later one has answered', async () => {
      const store = useScheduledTootsStore();
      let failFirst!: (err: Error) => void;
      api.getScheduledToots
        .mockReturnValueOnce(new Promise((_, reject) => { failFirst = reject; }))
        .mockResolvedValueOnce([original]);

      const first = store.fetchScheduledToots();
      await store.fetchScheduledToots();
      failFirst(new Error('Network Error'));
      await first;

      expect(store.error).toBe('');
      expect(store.toots).toEqual([original]);
    });
  });

  describe('session changes', () => {
    const credentials = { instance: 'https://masto.example', clientId: 'id', clientSecret: 'secret', accessToken: 'token-a' };

    it('drops the previous account toots and edit on sign-out', async () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);
      const store = useScheduledTootsStore();
      await nextTick();
      store.setToots([original]);
      store.setEditingToot(original);

      auth.accessToken = null;
      await nextTick();

      expect(store.toots).toEqual([]);
      expect(store.editingToot).toBeNull();
    });

    it('reloads the list when another account takes over', async () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);
      const store = useScheduledTootsStore();
      await nextTick();
      store.setToots([original]);

      auth.completeLogin({ ...credentials, accessToken: 'token-b' });
      await nextTick();

      expect(store.toots).toEqual([]);
      expect(api.getScheduledToots).toHaveBeenCalled();
    });

    it('discards a list that finishes loading after the session changed', async () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);
      const store = useScheduledTootsStore();
      let answer!: (toots: MastodonStatus[]) => void;
      api.getScheduledToots.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));

      const loading = store.fetchScheduledToots();
      auth.accessToken = null;
      await nextTick();
      answer([original]);
      await loading;

      expect(store.toots).toEqual([]);
    });

    it('forgets the progress of the previous account, and its late failure', async () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);
      const store = useScheduledTootsStore();
      await nextTick();
      let fail!: (err: Error) => void;
      api.deleteScheduledToot.mockReturnValueOnce(new Promise<void>((_, reject) => { fail = reject; }));

      const deleting = store.deleteToot('42');
      auth.completeLogin({ ...credentials, accessToken: 'token-b' });
      await nextTick();
      expect(store.pendingId).toBeNull();
      expect(store.pendingAction).toBeNull();

      fail(new Error('Record not found'));
      expect(await deleting).toBe(false);
      expect(store.error).toBe('');
      expect(store.pendingId).toBeNull();
    });

    it('does not show a late update failure of the previous account', async () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);
      const store = useScheduledTootsStore();
      await nextTick();
      let fail!: (err: Error) => void;
      api.rescheduleToot.mockReturnValueOnce(new Promise<void>((_, reject) => { fail = reject; }));

      const updating = store.updateToot(original, makeUpdated(), 'key-1');
      auth.accessToken = null;
      await nextTick();
      expect(store.pendingId).toBeNull();

      fail(new Error('Boom'));
      await expect(updating).rejects.toThrow('Boom');
      expect(store.error).toBe('');
    });

    it('leaves the new session edit alone when an update of the previous one succeeds late', async () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);
      const store = useScheduledTootsStore();
      await nextTick();
      let finish!: () => void;
      api.rescheduleToot.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));

      const updating = store.updateToot(original, makeUpdated(), 'key-1');
      auth.completeLogin({ ...credentials, accessToken: 'token-b' });
      await nextTick();
      const newEdit = { ...original, id: '7' };
      store.setEditingToot(newEdit);

      finish();
      await updating;

      expect(store.editingToot).toEqual(newEdit);
    });

    it('leaves the new session edit alone when a deletion of the previous one succeeds late', async () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);
      const store = useScheduledTootsStore();
      await nextTick();
      let finish!: () => void;
      api.deleteScheduledToot.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));

      const deleting = store.deleteToot('42');
      auth.completeLogin({ ...credentials, accessToken: 'token-b' });
      await nextTick();
      // Ids are per instance: the new account may well have a toot with the same id.
      store.setEditingToot(original);

      finish();
      await deleting;

      expect(store.editingToot).toEqual(original);
    });
  });
});
