import { z } from 'zod';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * True for an https URL (http only for a local instance in dev). Anything else coming from
 * the instance (javascript:, data:, plain http) is never put in an src attribute.
 * @param {string} value - The URL to check.
 * @returns {boolean} Whether the URL is safe to load.
 */
function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return import.meta.env.DEV && url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

const safeUrl = z.string().refine(isSafeUrl, 'must be an https URL');

/** GET /api/v1/accounts/verify_credentials */
export const AccountSchema = z.object({
  id: z.string(),
  username: z.string(),
  acct: z.string(),
  display_name: z.string(),
  avatar: safeUrl,
});

/** A media attachment; `preview_url` falls back to `url`, a null description becomes undefined. */
export const MediaAttachmentSchema = z.object({
  id: z.string(),
  type: z.enum(['image', 'video', 'gifv', 'audio', 'unknown']),
  url: safeUrl,
  preview_url: safeUrl.nullish(),
  description: z.string().nullish(),
}).transform(media => ({
  id: media.id,
  type: media.type,
  url: media.url,
  preview_url: media.preview_url ?? media.url,
  description: media.description ?? undefined,
}));

/**
 * A scheduled status. Only what the app relies on is checked; the params' other fields
 * (visibility, flags, poll...) are kept as sent, since their nullable and string forms
 * are already handled by isOnlyScheduleChange and the composer.
 */
export const ScheduledStatusSchema = z.object({
  id: z.string(),
  scheduled_at: z.string(),
  params: z.object({
    text: z.string().nullable().transform(text => text ?? ''),
  }).passthrough(),
  media_attachments: z.array(MediaAttachmentSchema),
}).passthrough();

/** POST /api/v1/apps */
export const AppRegistrationSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
});

/** POST /oauth/token */
export const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
});

/**
 * Validates data received from the instance. A mismatch is logged (in dev) and reported to the
 * user with a generic message: the app never acts on a response it does not understand.
 * @param {z.ZodTypeAny} schema - The expected shape.
 * @param {unknown} data - The response body.
 * @param {string} what - What was expected, for the log.
 * @returns {z.output} The validated (and normalized) data.
 * @throws {Error} If the data does not match the schema.
 */
export function parseApiResponse<T extends z.ZodTypeAny>(schema: T, data: unknown, what: string): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`Unexpected ${what} from the instance:`, result.error.issues);
    throw new Error('Your instance sent an unexpected response. Please try again later.');
  }
  return result.data;
}
