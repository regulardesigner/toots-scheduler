/** Poll parameters as sent to and returned by the Mastodon API. */
export interface PollParams {
  options: string[];
  expires_in: number;
  multiple?: boolean;
  hide_totals?: boolean;
}

/** Poll state as edited in the composer (PollSection v-model). */
export interface PollFormState {
  options: string[];
  expiresIn: number;
  multiple: boolean;
  hideTotals: boolean;
}

/**
 * The params of a scheduled status, echoed by Mastodon as the client sent them: any of them may be
 * null or missing. ScheduledStatusSchema checks text, visibility, media ids and poll options.
 */
export interface ScheduledStatusParams {
  text: string;
  visibility?: string | null;
  media_ids?: string[] | null;
  sensitive?: boolean | null;
  spoiler_text?: string | null;
  language?: string | null;
  poll?: PollParams | null;
}

/** A scheduled status (GET /api/v1/scheduled_statuses), as validated by ScheduledStatusSchema. */
export interface MastodonStatus {
  id: string;
  scheduled_at: string;
  params: ScheduledStatusParams;
  media_attachments: MastodonMediaAttachment[];
}

export interface MastodonMediaAttachment {
  id: string;
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
  /** Null while the instance is still processing the file. */
  url: string | null;
  /** Missing when the instance sent none, or an unsafe one. */
  preview_url?: string;
  description?: string;
}

export interface MastodonAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  /** Missing when the instance sent an unsafe URL. */
  avatar?: string;
}

export interface ScheduledToot {
  status: string;
  media_ids?: string[];
  scheduled_at?: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive?: boolean;
  spoiler_text?: string;
  language?: string;
  poll?: PollParams;
}

/**
 * The limits an instance reports (GET /api/v2/instance; GET /api/v1/instance as the fallback when v2
 * fails, or gives no text limit). A missing value: the instance gave none, or an invalid one.
 */
export interface InstanceConfiguration {
  maxCharacters?: number;
  maxMediaAttachments?: number;
  /** Bytes. */
  imageSizeLimit?: number;
  /** Every MIME type the instance accepts, images or not. */
  supportedMimeTypes?: string[];
}
