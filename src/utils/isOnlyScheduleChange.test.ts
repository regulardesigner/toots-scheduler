import { describe, it, expect } from 'vitest';
import { isOnlyScheduleChange } from './isOnlyScheduleChange';
import type { MastodonStatus, ScheduledToot } from '../types/mastodon';

function makeOriginal(params: Partial<NonNullable<MastodonStatus['params']>> = {}): MastodonStatus {
  return {
    id: '42',
    content: '',
    created_at: '',
    visibility: 'public',
    url: '',
    media_attachments: [],
    scheduled_at: '2030-01-01T12:00:00.000Z',
    params: {
      text: 'Hello',
      visibility: 'public',
      language: 'en',
      sensitive: false,
      spoiler_text: '',
      media_ids: [],
      poll: null,
      ...params,
    },
  };
}

function makeUpdated(overrides: Partial<ScheduledToot> = {}): ScheduledToot {
  return {
    status: 'Hello',
    scheduled_at: '2030-01-02T08:00:00.000Z',
    visibility: 'public',
    language: 'en',
    sensitive: false,
    spoiler_text: undefined,
    media_ids: [],
    ...overrides,
  };
}

describe('isOnlyScheduleChange', () => {
  it('is true when only the date changed', () => {
    expect(isOnlyScheduleChange(makeOriginal(), makeUpdated())).toBe(true);
  });

  it('treats null params from the API like empty values', () => {
    const original = makeOriginal({ sensitive: null as unknown as boolean, spoiler_text: null as unknown as string, media_ids: null as unknown as string[] });
    expect(isOnlyScheduleChange(original, makeUpdated())).toBe(true);
  });

  it.each([
    ['text', makeUpdated({ status: 'Hello!' })],
    ['visibility', makeUpdated({ visibility: 'unlisted' })],
    ['language', makeUpdated({ language: 'fr' })],
    ['sensitive flag', makeUpdated({ sensitive: true, spoiler_text: 'CW' })],
    ['media', makeUpdated({ media_ids: ['m1'] })],
    ['poll', makeUpdated({ poll: { options: ['Yes', 'No'], expires_in: 3600 } })],
  ])('is false when the %s changed', (_label, updated) => {
    expect(isOnlyScheduleChange(makeOriginal(), updated)).toBe(false);
  });

  it('compares polls after normalizing the duration and flags', () => {
    const original = makeOriginal({
      poll: { options: ['Yes', 'No'], expires_in: '3600' as unknown as number },
    });
    const updated = makeUpdated({ poll: { options: ['Yes', 'No'], expires_in: 3600, multiple: false, hide_totals: false } });
    expect(isOnlyScheduleChange(original, updated)).toBe(true);
  });

  it('falls back to media_attachments when params.media_ids is missing', () => {
    const original = { ...makeOriginal({ media_ids: undefined }), media_attachments: [{ id: 'm1' }] };
    expect(isOnlyScheduleChange(original, makeUpdated({ media_ids: ['m1'] }))).toBe(true);
  });

  it('is false when the original has no params', () => {
    expect(isOnlyScheduleChange({ ...makeOriginal(), params: undefined }, makeUpdated())).toBe(false);
  });
});
