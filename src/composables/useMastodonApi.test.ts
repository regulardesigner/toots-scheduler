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

/** A scheduled status as Mastodon returns it. */
function scheduled(id: string) {
  return {
    id,
    scheduled_at: '2031-01-01T12:00:00.000Z',
    params: { text: `Toot ${id}`, visibility: 'public', language: 'en', poll: null },
    media_attachments: [],
  };
}

const uploadedMedia = { id: 'm1', type: 'image', url: 'https://masto.example/m1.png', preview_url: 'https://masto.example/m1-small.png', description: null };

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

  describe('uploadMedia', () => {
    it('posts the file as multipart through the API client and reports progress', async () => {
      http.post.mockResolvedValue({ data: uploadedMedia });
      const onProgress = vi.fn();
      const file = new File(['x'], 'cat.png', { type: 'image/png' });

      const media = await useMastodonApi().uploadMedia(file, onProgress);

      const [url, body, config] = http.post.mock.calls[0];
      expect(url).toBe('https://masto.example/api/v2/media');
      expect((body as FormData).get('file')).toBeInstanceOf(File);
      expect(config).toMatchObject({ headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
      config.onUploadProgress({ loaded: 50, total: 200 });
      expect(onProgress).toHaveBeenCalledWith(25);
      expect(media).toEqual({ ...uploadedMedia, description: undefined });
    });

    it('keeps the original error as the cause', async () => {
      const original = { isAxiosError: true, message: 'Request failed', response: { status: 422, data: { error: 'File type not supported' } } };
      http.post.mockRejectedValue(original);

      const error = await useMastodonApi().uploadMedia(new File(['x'], 'a.pdf')).catch((e: Error) => e);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('File type not supported');
      expect((error as Error).cause).toBe(original);
    });
  });

  describe('response validation', () => {
    it('drops an avatar that is not an https URL, keeping the account', async () => {
      http.get.mockResolvedValue({ data: { id: '1', username: 'me', acct: 'me', display_name: 'Me', avatar: 'javascript:alert(1)' } });

      const account = await useMastodonApi().verifyCredentials();

      expect(account.avatar).toBeUndefined();
      expect(account.acct).toBe('me');
    });

    it('refuses an account without the fields the app needs', async () => {
      http.get.mockResolvedValue({ data: { id: '1', avatar: 'https://masto.example/a.png' } });

      await expect(useMastodonApi().verifyCredentials())
        .rejects.toThrow('Your instance sent an unexpected response. Please try again later.');
    });

    it('refuses a malformed page of scheduled toots instead of showing part of it', async () => {
      http.get.mockResolvedValue({ data: [scheduled('1'), { id: 2 }], headers: {} });

      await expect(useMastodonApi().getScheduledToots())
        .rejects.toThrow('Your instance sent an unexpected response. Please try again later.');
    });

    it('refuses an app registration without a client secret', async () => {
      http.post.mockResolvedValue({ data: { client_id: 'id' } });

      await expect(useMastodonApi().registerApplication('https://masto.example'))
        .rejects.toThrow('Your instance sent an unexpected response. Please try again later.');
    });
  });

  describe('sendThanks', () => {
    it('sends the previewed message as a direct message', async () => {
      http.post.mockResolvedValue({ data: { id: 'dm' } });

      await useMastodonApi().sendThanks('🤗 Thanks! CC: @dams@disabled.social');

      expect(http.post).toHaveBeenCalledWith('https://masto.example/api/v1/statuses', {
        status: '🤗 Thanks! CC: @dams@disabled.social',
        visibility: 'direct',
      });
    });

    it('reports a failure instead of hiding it', async () => {
      http.post.mockRejectedValue({ isAxiosError: true, message: 'Request failed', response: { status: 422, data: { error: 'Text too long' } } });

      await expect(useMastodonApi().sendThanks('Thanks')).rejects.toThrow('Text too long');
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

  describe('getInstanceConfiguration', () => {
    it('reads the limits from the v2 instance endpoint', async () => {
      http.get.mockResolvedValue({ data: { configuration: { statuses: { max_characters: 1000 } } } });

      const configuration = await useMastodonApi().getInstanceConfiguration();

      expect(http.get).toHaveBeenCalledWith('https://masto.example/api/v2/instance');
      expect(configuration.maxCharacters).toBe(1000);
      expect(configuration.supportedMimeTypes).toBeUndefined();
    });

    it('fails when the instance cannot be read', async () => {
      http.get.mockRejectedValue(new Error('Request failed with status code 404'));

      await expect(useMastodonApi().getInstanceConfiguration()).rejects.toThrow('Request failed with status code 404');
    });
  });

  describe('deleteScheduledToot', () => {
    it('encodes the id in the path', async () => {
      http.delete.mockResolvedValue({ data: {} });

      await useMastodonApi().deleteScheduledToot('../apps');

      expect(http.delete).toHaveBeenCalledWith('https://masto.example/api/v1/scheduled_statuses/..%2Fapps');
    });
  });

  describe('getScheduledToots', () => {
    it('follows the Link header across pages and concatenates the results', async () => {
      http.get
        .mockResolvedValueOnce({
          data: [scheduled('3'), scheduled('2')],
          headers: { link: '<https://masto.example/api/v1/scheduled_statuses?limit=40&max_id=2>; rel="next"' },
        })
        .mockResolvedValueOnce({ data: [scheduled('1')], headers: {} });

      const toots = await useMastodonApi().getScheduledToots();

      expect(toots.map(t => t.id)).toEqual(['3', '2', '1']);
      expect(http.get.mock.calls.map(call => call[0])).toEqual([
        'https://masto.example/api/v1/scheduled_statuses?limit=40',
        'https://masto.example/api/v1/scheduled_statuses?limit=40&max_id=2',
      ]);
    });

    it('does not follow a next link pointing to another origin', async () => {
      http.get.mockResolvedValueOnce({
        data: [scheduled('1')],
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
          data: [scheduled(`id-${page}`)],
          headers: { link: `<https://masto.example/api/v1/scheduled_statuses?max_id=${page}>; rel="next"` },
        };
      });

      await useMastodonApi().getScheduledToots();

      expect(http.get).toHaveBeenCalledTimes(10);
    });

    it('stops when the server links back to a page it already returned', async () => {
      http.get.mockResolvedValue({
        data: [scheduled('1')],
        headers: { link: '<https://masto.example/api/v1/scheduled_statuses?limit=40>; rel="next"' },
      });

      const toots = await useMastodonApi().getScheduledToots();

      expect(http.get).toHaveBeenCalledTimes(1);
      expect(toots).toHaveLength(1);
    });

    it('stops on an empty page', async () => {
      http.get
        .mockResolvedValueOnce({ data: [scheduled('1')], headers: { link: '<https://masto.example/api/v1/scheduled_statuses?max_id=1>; rel="next"' } })
        .mockResolvedValueOnce({ data: [], headers: { link: '<https://masto.example/api/v1/scheduled_statuses?max_id=0>; rel="next"' } });

      await useMastodonApi().getScheduledToots();

      expect(http.get).toHaveBeenCalledTimes(2);
    });

    it('fails as a whole when a later page fails, so no toot is silently hidden', async () => {
      http.get
        .mockResolvedValueOnce({ data: [scheduled('1')], headers: { link: '<https://masto.example/api/v1/scheduled_statuses?max_id=1>; rel="next"' } })
        .mockRejectedValueOnce(new Error('Network Error'));

      await expect(useMastodonApi().getScheduledToots()).rejects.toThrow('Network Error');
    });
  });
});
