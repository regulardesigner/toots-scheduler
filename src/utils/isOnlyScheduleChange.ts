import type { MastodonStatus, PollParams, ScheduledToot } from '../types/mastodon';

/** Mastodon echoes params as the client sent them, so booleans may come back as "true"/"false". */
function toBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function samePoll(a: PollParams | null | undefined, b: PollParams | null | undefined): boolean {
  if (!a || !b) return !a && !b;

  const durationA = Number(a.expires_in);
  const durationB = Number(b.expires_in);
  if (!Number.isFinite(durationA) || !Number.isFinite(durationB)) return false;

  return sameList(a.options, b.options)
    && durationA === durationB
    && toBoolean(a.multiple) === toBoolean(b.multiple)
    && toBoolean(a.hide_totals) === toBoolean(b.hide_totals);
}

/**
 * Tells whether an edited toot differs from its scheduled original by its date only.
 * In that case it can be rescheduled in place (PUT) instead of being recreated.
 * Any doubt returns false: recreating is always safe, a false positive would drop the user's edit.
 * Also true when nothing changed at all (rescheduling to the same date is harmless).
 * @param {MastodonStatus} original - The scheduled status as returned by the API.
 * @param {ScheduledToot} updated - The payload built from the edited form.
 * @returns {boolean} True when only `scheduled_at` changed.
 */
export function isOnlyScheduleChange(original: MastodonStatus, updated: ScheduledToot): boolean {
  const params = original.params;
  // A null visibility means "account default": recreate so the toot gets exactly what the form showed.
  if (!params || params.visibility == null) return false;

  const originalMediaIds: string[] = params.media_ids
    ?? (original.media_attachments ?? []).map((media: { id: string }) => media.id);

  return (
    (params.text ?? '') === updated.status
    && params.visibility === updated.visibility
    && (params.language ?? null) === (updated.language ?? null)
    && toBoolean(params.sensitive) === toBoolean(updated.sensitive)
    && (params.spoiler_text ?? '') === (updated.spoiler_text ?? '')
    && sameList(originalMediaIds, updated.media_ids ?? [])
    && samePoll(params.poll, updated.poll)
  );
}
