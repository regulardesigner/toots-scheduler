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

export interface MastodonStatus {
  id: string;
  content: string;
  created_at: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  url: string;
  media_attachments: any[];
  scheduled_at?: string;
  spoiler_text?: string;
  language?: string;
  poll?: PollParams;
  params?: {
    text: string;
    media_ids?: string[];
    scheduled_at?: string;
    visibility?: 'public' | 'unlisted' | 'private' | 'direct';
    sensitive?: boolean;
    spoiler_text?: string;
    language?: string;
    poll?: PollParams | null;
  };
  status?: string;
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
