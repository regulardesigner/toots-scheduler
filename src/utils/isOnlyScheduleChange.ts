import type { MastodonStatus, PollParams, ScheduledToot } from '../types/mastodon';

function normalizePoll(poll: PollParams | null | undefined) {
  if (!poll) return null;
  return {
    options: poll.options,
    expires_in: Number(poll.expires_in),
    multiple: poll.multiple === true,
    hide_totals: poll.hide_totals === true,
  };
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Tells whether an edited toot differs from its scheduled original by its date only.
 * In that case it can be rescheduled in place (PUT) instead of being recreated.
 * Mastodon returns null for unset params, so both sides are normalized before comparing.
 * @param {MastodonStatus} original - The scheduled status as returned by the API.
 * @param {ScheduledToot} updated - The payload built from the edited form.
 * @returns {boolean} True when only `scheduled_at` changed.
 */
export function isOnlyScheduleChange(original: MastodonStatus, updated: ScheduledToot): boolean {
  const params = original.params;
  if (!params) return false;

  const originalMediaIds: string[] = params.media_ids
    ?? (original.media_attachments ?? []).map((media: { id: string }) => media.id);

  return (
    (params.text ?? '') === updated.status
    && (params.visibility ?? 'public') === updated.visibility
    && (params.language ?? null) === (updated.language ?? null)
    && (params.sensitive === true) === (updated.sensitive === true)
    && (params.spoiler_text ?? '') === (updated.spoiler_text ?? '')
    && sameList(originalMediaIds, updated.media_ids ?? [])
    && JSON.stringify(normalizePoll(params.poll)) === JSON.stringify(normalizePoll(updated.poll))
  );
}
