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
  poll?: {
    options: string[];
    expires_in: number;
    multiple?: boolean;
    hide_totals?: boolean;
  };
  params?: {
    text: string;
    media_ids?: string[];
    scheduled_at?: string;
    visibility?: 'public' | 'unlisted' | 'private' | 'direct';
    sensitive?: boolean;
    spoiler_text?: string;
    language?: string;
    poll?: {
      options: string[];
      expires_in: number;
      multiple?: boolean;
      hide_totals?: boolean;
    };
  };
  status?: string;
}

export interface MastodonMediaAttachment {
  id: string;
  type: 'image' | 'video' | 'gifv' | 'audio';
  url: string;
  preview_url: string;
  description?: string;
}

export interface MastodonAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string;
}

export interface ScheduledToot {
  status: string;
  media_ids?: string[];
  scheduled_at?: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive?: boolean;
  spoiler_text?: string;
  language?: string;
  poll?: {
    options: string[];
    expires_in: number;
    multiple?: boolean;
    hide_totals?: boolean;
  };
} 