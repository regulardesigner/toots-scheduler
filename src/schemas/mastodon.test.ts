import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  AccountSchema,
  AppRegistrationSchema,
  InstanceSchema,
  MediaAttachmentSchema,
  ScheduledStatusSchema,
  TokenResponseSchema,
  parseApiResponse,
} from './mastodon';

const account = { id: '1', username: 'alice', acct: 'alice', display_name: 'Alice', avatar: 'https://masto.example/a.png', bot: false };
const media = { id: 'm1', type: 'image', url: 'https://masto.example/m1.png', preview_url: 'https://masto.example/m1-small.png', description: null };
const scheduled = {
  id: 's1',
  scheduled_at: '2031-01-01T12:00:00.000Z',
  params: { text: 'Hello', visibility: null, language: null, sensitive: null, spoiler_text: null, media_ids: null, poll: null },
  media_attachments: [],
};

describe('mastodon schemas', () => {
  it('accepts an account and drops fields the app does not use', () => {
    expect(AccountSchema.parse(account)).toEqual({ id: '1', username: 'alice', acct: 'alice', display_name: 'Alice', avatar: 'https://masto.example/a.png' });
  });

  it('drops an avatar that is not an https URL instead of refusing the account', () => {
    for (const avatar of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', ' javascript:alert(1)', 'http://evil.example/a.png', 'data:image/png;base64,AAAA', '']) {
      const parsed = AccountSchema.parse({ ...account, avatar });
      expect(parsed.avatar).toBeUndefined();
      expect(parsed.acct).toBe('alice');
    }
  });

  it('normalizes a media attachment', () => {
    expect(MediaAttachmentSchema.parse(media)).toEqual({ ...media, description: undefined });
    expect(MediaAttachmentSchema.parse({ ...media, preview_url: null }).preview_url).toBe('https://masto.example/m1.png');
  });

  it('accepts a media attachment still being processed (202: url is null)', () => {
    const processing = MediaAttachmentSchema.parse({ id: 'v1', type: 'video', url: null, preview_url: 'https://masto.example/v1.png', description: null });
    expect(processing.url).toBeNull();
    expect(processing.preview_url).toBe('https://masto.example/v1.png');
  });

  it('drops unsafe media URLs and refuses an unknown type', () => {
    const parsed = MediaAttachmentSchema.parse({ ...media, url: 'javascript:alert(1)', preview_url: 'data:image/png;base64,AA' });
    expect(parsed.url).toBeNull();
    expect(parsed.preview_url).toBeUndefined();
    expect(MediaAttachmentSchema.safeParse({ ...media, type: 'hologram' }).success).toBe(false);
  });

  it('accepts a scheduled status whose params are null, and keeps them as sent', () => {
    const parsed = ScheduledStatusSchema.parse(scheduled);
    expect(parsed.params.visibility).toBeNull();
    expect(parsed.params.text).toBe('Hello');
    expect(ScheduledStatusSchema.parse({ ...scheduled, params: { ...scheduled.params, text: null } }).params.text).toBe('');
  });

  it('accepts a scheduled status without a text key and keeps unknown fields', () => {
    const params = { visibility: 'public', language: 'en', poll: null, quoted_status_id: '9' };
    const parsed = ScheduledStatusSchema.parse({ ...scheduled, params });
    expect(parsed.params.text).toBe('');
    expect(parsed.params.quoted_status_id).toBe('9');
  });

  it('refuses a scheduled status without a usable shape', () => {
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, media_attachments: 'none' }).success).toBe(false);
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, params: undefined }).success).toBe(false);
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, id: 42 }).success).toBe(false);
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, params: { ...scheduled.params, poll: { options: [{ evil: 1 }] } } }).success).toBe(false);
  });

  it('reads a sensitive flag echoed as "true" or "false" as a boolean', () => {
    const sensitive = (value: unknown) => ScheduledStatusSchema.parse({ ...scheduled, params: { ...scheduled.params, sensitive: value } }).params.sensitive;

    expect(sensitive('false')).toBe(false);
    expect(sensitive('true')).toBe(true);
    expect(sensitive(false)).toBe(false);
    expect(sensitive(true)).toBe(true);
    expect(sensitive(null)).toBeNull();
    expect(ScheduledStatusSchema.parse({ ...scheduled, params: { text: 'Hello' } }).params.sensitive).toBeUndefined();
  });

  it('refuses a sensitive flag it cannot read, so it is never taken for "not sensitive"', () => {
    for (const value of ['1', 'yes', 1, {}]) {
      expect(ScheduledStatusSchema.safeParse({ ...scheduled, params: { ...scheduled.params, sensitive: value } }).success).toBe(false);
    }
  });

  it('does not let __proto__ in a response pollute objects', () => {
    const parsed = ScheduledStatusSchema.parse(JSON.parse('{"__proto__":{"polluted":true},"id":"s1","scheduled_at":"2031-01-01T12:00:00.000Z","params":{"text":"x","__proto__":{"polluted":true}},"media_attachments":[]}'));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
  });

  it('requires credentials in app registration and token responses', () => {
    expect(AppRegistrationSchema.safeParse({ client_id: 'id' }).success).toBe(false);
    expect(TokenResponseSchema.safeParse({ access_token: '' }).success).toBe(false);
    expect(TokenResponseSchema.parse({ access_token: 't', token_type: 'Bearer' })).toEqual({ access_token: 't' });
  });

  it('reports an unexpected response with a generic message', () => {
    expect(() => parseApiResponse(AccountSchema, { id: 1 }, 'account'))
      .toThrow('Your instance sent an unexpected response. Please try again later.');
    expect(parseApiResponse(AccountSchema, account, 'account').acct).toBe('alice');
  });

  it('refuses fields the interface would crash on: invalid date, non-string visibility, non-array media ids', () => {
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, scheduled_at: 'garbage' }).success).toBe(false);
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, params: { ...scheduled.params, visibility: { evil: 1 } } }).success).toBe(false);
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, params: { ...scheduled.params, media_ids: 'm1' } }).success).toBe(false);
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, scheduled_at: 'Mon, 01 Jan 2031 12:00:00 GMT' }).success).toBe(false);
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, scheduled_at: '2031-01-01T12:00:00+00:00' }).success).toBe(true);
  });

  it('reads the instance limits the composer needs', () => {
    const instance = {
      domain: 'masto.example',
      configuration: {
        statuses: { max_characters: 1000, max_media_attachments: 6, characters_reserved_per_url: 23 },
        media_attachments: { supported_mime_types: ['image/png', 'video/mp4'], image_size_limit: 16777216 },
      },
    };
    expect(InstanceSchema.parse(instance)).toEqual({
      maxCharacters: 1000,
      maxMediaAttachments: 6,
      imageSizeLimit: 16777216,
      supportedMimeTypes: ['image/png', 'video/mp4'],
    });
  });

  it('keeps the valid MIME types when the list has other entries', () => {
    const parsed = InstanceSchema.parse({ configuration: { media_attachments: { supported_mime_types: ['image/png', null, 42, 'image/webp'] } } });
    expect(parsed.supportedMimeTypes).toEqual(['image/png', 'image/webp']);
  });

  it('drops missing or invalid instance limits instead of refusing the response', () => {
    const parsed = InstanceSchema.parse({
      configuration: {
        statuses: { max_characters: -1, max_media_attachments: 2.5 },
        media_attachments: { supported_mime_types: 'image/png', image_size_limit: '8MB' },
      },
    });
    expect(parsed).toEqual({ maxCharacters: undefined, maxMediaAttachments: undefined, imageSizeLimit: undefined, supportedMimeTypes: undefined });
    expect(InstanceSchema.parse({ configuration: 'none' }).maxCharacters).toBeUndefined();
    expect(InstanceSchema.parse({}).maxCharacters).toBeUndefined();
    expect(InstanceSchema.safeParse('<html>').success).toBe(false);
  });
});

describe('parseApiResponse logging', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs the path and code of each issue on one line, never a received value', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseApiResponse(AccountSchema, { ...account, id: 'Bearer abc', acct: 42 }, 'account')).toThrow();

    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0][0]);
    expect(line).toContain('Unexpected account from the instance');
    expect(line).toContain('acct: invalid_type');
    expect(line).not.toContain('\n');
    expect(JSON.stringify(log.mock.calls)).not.toContain('Bearer abc');
  });
});
