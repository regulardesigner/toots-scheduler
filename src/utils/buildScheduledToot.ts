import type { PollFormState, ScheduledToot } from '../types/mastodon';

/** The composer state needed to build a scheduled toot payload. */
export interface ComposerForm {
  content: string;
  scheduledAt: Date;
  visibility: ScheduledToot['visibility'];
  language: string;
  isSensitive: boolean;
  spoilerText: string;
  mediaIds: string[];
  showPoll: boolean;
  poll: PollFormState;
}

const MIN_POLL_OPTIONS = 2;

/**
 * Builds the Mastodon payload for a scheduled toot from the composer state.
 * The poll is only sent when its section is open and at least one option is filled in.
 * @param {ComposerForm} form - The current composer state.
 * @returns {ScheduledToot} The payload for POST /api/v1/statuses.
 * @throws {Error} If the poll has a single option, or is combined with media.
 */
export function buildScheduledToot(form: ComposerForm): ScheduledToot {
  const spoilerText = form.spoilerText.trim();
  const toot: ScheduledToot = {
    status: form.content.trim(),
    scheduled_at: form.scheduledAt.toISOString(),
    visibility: form.visibility,
    language: form.language,
    sensitive: form.isSensitive,
    spoiler_text: form.isSensitive && spoilerText ? spoilerText : undefined,
    media_ids: form.mediaIds,
  };

  if (!form.showPoll) return toot;

  const options = form.poll.options.map(option => option.trim()).filter(option => option !== '');
  if (options.length === 0) return toot;
  if (options.length < MIN_POLL_OPTIONS) {
    throw new Error('A poll needs at least two options.');
  }
  if (form.mediaIds.length > 0) {
    throw new Error('A toot cannot have both a poll and media.');
  }

  toot.poll = {
    options,
    expires_in: Number(form.poll.expiresIn),
    multiple: form.poll.multiple,
    hide_totals: form.poll.hideTotals,
  };
  return toot;
}
