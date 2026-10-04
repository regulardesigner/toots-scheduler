import { describe, it, expect } from 'vitest';
import {
  AccountSchema,
  AppRegistrationSchema,
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

  it('refuses an avatar that is not an https URL', () => {
    expect(AccountSchema.safeParse({ ...account, avatar: 'javascript:alert(1)' }).success).toBe(false);
    expect(AccountSchema.safeParse({ ...account, avatar: 'http://evil.example/a.png' }).success).toBe(false);
    expect(AccountSchema.safeParse({ ...account, avatar: 'data:image/png;base64,AAAA' }).success).toBe(false);
  });

  it('normalizes a media attachment', () => {
    expect(MediaAttachmentSchema.parse(media)).toEqual({ ...media, description: undefined });
    expect(MediaAttachmentSchema.parse({ ...media, preview_url: null }).preview_url).toBe('https://masto.example/m1.png');
  });

  it('refuses a media attachment with an unsafe URL or an unknown type', () => {
    expect(MediaAttachmentSchema.safeParse({ ...media, preview_url: 'javascript:alert(1)' }).success).toBe(false);
    expect(MediaAttachmentSchema.safeParse({ ...media, type: 'hologram' }).success).toBe(false);
  });

  it('accepts a scheduled status whose params are null, and keeps them as sent', () => {
    const parsed = ScheduledStatusSchema.parse(scheduled);
    expect(parsed.params.visibility).toBeNull();
    expect(parsed.params.text).toBe('Hello');
    expect(ScheduledStatusSchema.parse({ ...scheduled, params: { ...scheduled.params, text: null } }).params.text).toBe('');
  });

  it('refuses a scheduled status without a usable shape', () => {
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, media_attachments: 'none' }).success).toBe(false);
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, params: undefined }).success).toBe(false);
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, id: 42 }).success).toBe(false);
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
});
