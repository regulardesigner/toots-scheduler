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

    it('encodes the id in the path', async () => {
      http.put.mockResolvedValue({ data: {} });

      await useMastodonApi().rescheduleToot('../apps', '2030-02-01T09:00:00.000Z');

      expect(http.put.mock.calls[0][0]).toBe('https://masto.example/api/v1/scheduled_statuses/..%2Fapps');
    });
  });

  describe('scheduledTootExists', () => {
    it('is true when the scheduled status is found', async () => {
      http.get.mockResolvedValue({ data: { id: '42' } });

      await expect(useMastodonApi().scheduledTootExists('42')).resolves.toBe(true);
      expect(http.get).toHaveBeenCalledWith('https://masto.example/api/v1/scheduled_statuses/42');
    });

    it('is false on a 404 (already published or deleted)', async () => {
      http.get.mockRejectedValue({ isAxiosError: true, response: { status: 404, data: { error: 'Record not found' } } });

      await expect(useMastodonApi().scheduledTootExists('42')).resolves.toBe(false);
    });

    it('throws on any other error', async () => {
      http.get.mockRejectedValue({ isAxiosError: true, response: { status: 500, data: { error: 'Boom' } } });

      await expect(useMastodonApi().scheduledTootExists('42')).rejects.toThrow('Boom');
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
      let page = 0;
      http.get.mockImplementation(async () => {
        page++;
        return {
          data: [{ id: `id-${page}` }],
          headers: { link: `<https://masto.example/api/v1/scheduled_statuses?max_id=${page}>; rel="next"` },
        };
      });

      await useMastodonApi().getScheduledToots();

      expect(http.get).toHaveBeenCalledTimes(10);
    });

    it('stops when the server links back to a page it already returned', async () => {
      http.get.mockResolvedValue({
        data: [{ id: '1' }],
        headers: { link: '<https://masto.example/api/v1/scheduled_statuses?limit=40>; rel="next"' },
      });

      const toots = await useMastodonApi().getScheduledToots();

      expect(http.get).toHaveBeenCalledTimes(1);
      expect(toots).toHaveLength(1);
    });

    it('stops on an empty page', async () => {
      http.get
        .mockResolvedValueOnce({ data: [{ id: '1' }], headers: { link: '<https://masto.example/api/v1/scheduled_statuses?max_id=1>; rel="next"' } })
        .mockResolvedValueOnce({ data: [], headers: { link: '<https://masto.example/api/v1/scheduled_statuses?max_id=0>; rel="next"' } });

      await useMastodonApi().getScheduledToots();

      expect(http.get).toHaveBeenCalledTimes(2);
    });

    it('fails as a whole when a later page fails, so no toot is silently hidden', async () => {
      http.get
        .mockResolvedValueOnce({ data: [{ id: '1' }], headers: { link: '<https://masto.example/api/v1/scheduled_statuses?max_id=1>; rel="next"' } })
        .mockRejectedValueOnce(new Error('Network Error'));

      await expect(useMastodonApi().getScheduledToots()).rejects.toThrow('Network Error');
    });
  });
});
