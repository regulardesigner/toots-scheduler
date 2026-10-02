import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScheduledToot } from '../types/mastodon';

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../utils/api', () => ({ createApiClient: () => http }));
vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({ instance: 'https://masto.example', accessToken: 'token' }),
}));

import { useMastodonApi } from './useMastodonApi';

const toot: ScheduledToot = {
  status: 'Hello',
  scheduled_at: '2030-01-01T12:00:00.000Z',
  visibility: 'public',
  language: 'en',
  media_ids: [],
};

describe('useMastodonApi', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('scheduleToot', () => {
    it('sends the idempotency key as a header, not in the body', async () => {
      http.post.mockResolvedValue({ data: { id: '1' } });

      await useMastodonApi().scheduleToot(toot, 'draft-key-1');

      const [url, body, config] = http.post.mock.calls[0];
      expect(url).toBe('https://masto.example/api/v1/statuses');
      expect(config).toEqual({ headers: { 'Idempotency-Key': 'draft-key-1' } });
      expect(body).not.toHaveProperty('idempotency');
      expect(body).toMatchObject({ status: 'Hello', scheduled_at: '2030-01-01T12:00:00.000Z' });
    });
  });

  describe('rescheduleToot', () => {
    it('PUTs only the new date to the scheduled status', async () => {
      http.put.mockResolvedValue({ data: { id: '42' } });

      await useMastodonApi().rescheduleToot('42', '2030-02-01T09:00:00.000Z');

      expect(http.put).toHaveBeenCalledWith(
        'https://masto.example/api/v1/scheduled_statuses/42',
        { scheduled_at: '2030-02-01T09:00:00.000Z' },
      );
    });
  });

  describe('getScheduledToots', () => {
    it('follows the Link header across pages and concatenates the results', async () => {
      http.get
        .mockResolvedValueOnce({
          data: [{ id: '3' }, { id: '2' }],
          headers: { link: '<https://masto.example/api/v1/scheduled_statuses?limit=40&max_id=2>; rel="next"' },
        })
        .mockResolvedValueOnce({ data: [{ id: '1' }], headers: {} });

      const toots = await useMastodonApi().getScheduledToots();

      expect(toots.map(t => t.id)).toEqual(['3', '2', '1']);
      expect(http.get.mock.calls.map(call => call[0])).toEqual([
        'https://masto.example/api/v1/scheduled_statuses?limit=40',
        'https://masto.example/api/v1/scheduled_statuses?limit=40&max_id=2',
      ]);
    });

    it('does not follow a next link pointing to another origin', async () => {
      http.get.mockResolvedValueOnce({
        data: [{ id: '1' }],
        headers: { link: '<https://evil.example/collect>; rel="next"' },
      });

      const toots = await useMastodonApi().getScheduledToots();

      expect(toots).toHaveLength(1);
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('stops after 10 pages even if the server keeps announcing more', async () => {
      http.get.mockResolvedValue({
        data: [{ id: 'x' }],
        headers: { link: '<https://masto.example/api/v1/scheduled_statuses?max_id=x>; rel="next"' },
      });

      await useMastodonApi().getScheduledToots();

      expect(http.get).toHaveBeenCalledTimes(10);
    });
  });
});
