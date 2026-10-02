import { describe, it, expect } from 'vitest';
import { buildScheduledToot, type ComposerForm } from './buildScheduledToot';

function makeForm(overrides: Partial<ComposerForm> = {}): ComposerForm {
  return {
    content: '  Hello world  ',
    scheduledAt: new Date('2030-01-01T12:00:00.000Z'),
    visibility: 'public',
    language: 'fr',
    isSensitive: false,
    spoilerText: '',
    mediaIds: [],
    showPoll: false,
    poll: { options: ['', ''], expiresIn: 86400, multiple: false, hideTotals: false },
    ...overrides,
  };
}

describe('buildScheduledToot', () => {
  it('builds a plain toot with trimmed text and an ISO date', () => {
    expect(buildScheduledToot(makeForm())).toEqual({
      status: 'Hello world',
      scheduled_at: '2030-01-01T12:00:00.000Z',
      visibility: 'public',
      language: 'fr',
      sensitive: false,
      spoiler_text: undefined,
      media_ids: [],
    });
  });

  it('keeps the content warning only when the toot is sensitive', () => {
    expect(buildScheduledToot(makeForm({ isSensitive: true, spoilerText: ' Spoilers ' })).spoiler_text).toBe('Spoilers');
    expect(buildScheduledToot(makeForm({ isSensitive: false, spoilerText: 'Spoilers' })).spoiler_text).toBeUndefined();
  });

  it('ignores poll options when the poll section is closed', () => {
    const toot = buildScheduledToot(makeForm({
      showPoll: false,
      poll: { options: ['Yes', 'No'], expiresIn: 3600, multiple: false, hideTotals: false },
      mediaIds: ['m1'],
    }));
    expect(toot.poll).toBeUndefined();
    expect(toot.media_ids).toEqual(['m1']);
  });

  it('sends an open poll with trimmed, non-empty options and a numeric duration', () => {
    const toot = buildScheduledToot(makeForm({
      showPoll: true,
      poll: { options: [' Yes ', '', 'No'], expiresIn: '3600' as unknown as number, multiple: true, hideTotals: true },
    }));
    expect(toot.poll).toEqual({ options: ['Yes', 'No'], expires_in: 3600, multiple: true, hide_totals: true });
  });

  it('treats an open poll with no options filled in as no poll', () => {
    expect(buildScheduledToot(makeForm({ showPoll: true })).poll).toBeUndefined();
  });

  it('rejects a poll with a single option', () => {
    expect(() => buildScheduledToot(makeForm({
      showPoll: true,
      poll: { options: ['Only one', ''], expiresIn: 3600, multiple: false, hideTotals: false },
    }))).toThrow('A poll needs at least two options.');
  });

  it('rejects a poll combined with media', () => {
    expect(() => buildScheduledToot(makeForm({
      showPoll: true,
      mediaIds: ['m1'],
      poll: { options: ['Yes', 'No'], expiresIn: 3600, multiple: false, hideTotals: false },
    }))).toThrow('A toot cannot have both a poll and media.');
  });
});
