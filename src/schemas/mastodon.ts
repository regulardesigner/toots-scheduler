import { z } from 'zod';
import { isValid, parseISO } from 'date-fns';

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

/**
 * An optional URL from the instance: an unsafe or missing value is dropped (undefined)
 * rather than failing the whole response. A bad avatar or preview must not block sign-in
 * or hide a toot, and it never reaches the page either way.
 */
const optionalSafeUrl = safeUrl.optional().catch(undefined);

/** GET /api/v1/accounts/verify_credentials */
export const AccountSchema = z.object({
  id: z.string(),
  username: z.string(),
  acct: z.string(),
  display_name: z.string(),
  avatar: optionalSafeUrl,
});

/**
 * A media attachment. `url` is null while the instance still processes the file (202 on upload);
 * `preview_url` falls back to `url`; unsafe URLs are dropped; a null description becomes undefined.
 */
export const MediaAttachmentSchema = z.object({
  id: z.string(),
  type: z.enum(['image', 'video', 'gifv', 'audio', 'unknown']),
  url: optionalSafeUrl,
  preview_url: optionalSafeUrl,
  description: z.string().nullish(),
}).transform(media => ({
  id: media.id,
  type: media.type,
  url: media.url ?? null,
  preview_url: media.preview_url ?? media.url,
  description: media.description ?? undefined,
}));

/**
 * A scheduled status. What the app renders or compares is checked (date, text, visibility,
 * media ids, poll options); the other params are kept as sent, since their nullable and string
 * forms are already handled by isOnlyScheduleChange and the composer.
 */
export const ScheduledStatusSchema = z.object({
  id: z.string(),
  // Parsed with date-fns parseISO by the list and the edit form: anything else would crash them.
  scheduled_at: z.string().refine(value => isValid(parseISO(value)), 'must be an ISO 8601 date'),
  params: z.object({
    text: z.string().nullish().transform(text => text ?? ''),
    visibility: z.string().nullish(),
    media_ids: z.array(z.string()).nullish(),
    // Rendered by the composer when editing: options must be strings.
    poll: z.object({ options: z.array(z.string()) }).passthrough().nullish(),
  }).passthrough(),
  media_attachments: z.array(MediaAttachmentSchema),
}).passthrough();

/** A limit from the instance: a positive whole number, or dropped (undefined) so the app's default applies. */
const optionalLimit = z.number().int().positive().optional().catch(undefined);

/**
 * GET /api/v2/instance, reduced to the limits the composer follows. Every part is optional:
 * a missing or invalid value is dropped and the app keeps its default for it, so an unusual
 * instance never blocks the composer. Only a body that is not an object is refused.
 */
export const InstanceSchema = z.object({
  configuration: z.object({
    statuses: z.object({
      max_characters: optionalLimit,
      max_media_attachments: optionalLimit,
    }).optional().catch(undefined),
    media_attachments: z.object({
      image_size_limit: optionalLimit,
      supported_mime_types: z.array(z.string()).optional().catch(undefined),
    }).optional().catch(undefined),
  }).optional().catch(undefined),
}).transform(instance => ({
  maxCharacters: instance.configuration?.statuses?.max_characters,
  maxMediaAttachments: instance.configuration?.statuses?.max_media_attachments,
  imageSizeLimit: instance.configuration?.media_attachments?.image_size_limit,
  supportedMimeTypes: instance.configuration?.media_attachments?.supported_mime_types,
}));

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
