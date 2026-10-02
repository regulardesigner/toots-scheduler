import axios from 'axios';
import { createApiClient } from '../utils/api';
import { useAuthStore } from '../stores/auth';
import type { MastodonStatus, ScheduledToot, MastodonMediaAttachment } from '../types/mastodon';
import { getRedirectUri, OAUTH_SCOPES } from '../config/constants';
import { handleApiError } from '../utils/error';
import { getNextPageUrl } from '../utils/linkHeader';

/** Mastodon's maximum page size for scheduled statuses. */
const SCHEDULED_PAGE_SIZE = 40;
/** Safety cap: 10 pages × 40 = 400 toots, above Mastodon's 300 scheduled-toot limit. */
const MAX_SCHEDULED_PAGES = 10;

/** Large images on slow connections need far more than the default 10 s. */
const MEDIA_UPLOAD_TIMEOUT_MS = 120000;

/**
 * Creates a composable for interacting with the Mastodon API.
 * @returns {Object} An object containing functions for Mastodon API operations.
 */
export function useMastodonApi() {
  const auth = useAuthStore();
  const api = createApiClient();

  /**
   * Registers a new application with the Mastodon instance.
   * @param {string} instanceUrl - The origin of the Mastodon instance (already normalized).
   * @returns {Promise<{ client_id: string; client_secret: string }>} The app credentials.
   * @throws {Error} If the registration fails or the response is invalid.
   */
  async function registerApplication(instanceUrl: string): Promise<{ client_id: string; client_secret: string }> {
    try {
      const response = await api.post(`${instanceUrl}/api/v1/apps`, {
        client_name: 'Toot Scheduler',
        redirect_uris: getRedirectUri(),
        scopes: OAUTH_SCOPES,
        website: window.location.origin + import.meta.env.BASE_URL,
      });

      if (!response.data?.client_id || !response.data?.client_secret) {
        throw new Error('Invalid response from server');
      }

      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Exchanges the authorization code for an access token, proving PKCE possession with the verifier.
   * @param {string} instanceUrl - The instance origin the login started with.
   * @param {string} code - The authorization code.
   * @param {string} clientId - The client ID.
   * @param {string} clientSecret - The client secret.
   * @param {string} codeVerifier - The PKCE verifier matching the challenge sent to /oauth/authorize.
   * @returns {Promise<{ access_token: string }>} The access token data.
   * @throws {Error} If the request fails or no token is returned.
   */
  async function getAccessToken(
    instanceUrl: string,
    code: string,
    clientId: string,
    clientSecret: string,
    codeVerifier: string,
  ): Promise<{ access_token: string }> {
    try {
      const response = await api.post(`${instanceUrl}/oauth/token`, {
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getRedirectUri(),
        code_verifier: codeVerifier,
        scope: OAUTH_SCOPES,
      });

      if (!response.data?.access_token) {
        throw new Error('Invalid response from server');
      }

      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Verifies the user's credentials with the Mastodon instance.
   * @returns {Promise<Object>} The verified account data.
   * @throws {Error} If the instance URL is not set.
   */
  async function verifyCredentials() {
    if (!auth.instance) throw new Error('No instance URL set');
    const response = await api.get(`${auth.instance}/api/v1/accounts/verify_credentials`);
    return response.data;
  }

  /**
   * Schedules a toot to be posted at a later time.
   * @param {ScheduledToot} toot - The toot data including content and scheduling information.
   * @param {string} idempotencyKey - Unique key per draft; Mastodon ignores a resubmission with the same key for 1 hour.
   * @returns {Promise<MastodonStatus>} The scheduled toot data.
   * @throws {Error} If the instance URL is not set or the request fails.
   */
  async function scheduleToot(toot: ScheduledToot, idempotencyKey: string): Promise<MastodonStatus> {
    if (!auth.instance) throw new Error('No instance URL set');
  
    try {
      if (!toot.status) {
        throw new Error('Status content is required');
      }
  
      // Format the request payload according to Mastodon API specs
      const payload: Record<string, unknown> = {
        status: toot.status,
        scheduled_at: toot.scheduled_at,
        media_ids: toot.media_ids || [],
        visibility: toot.visibility || 'public',
        sensitive: toot.sensitive || false,
        spoiler_text: toot.spoiler_text || '',
        language: toot.language || null,
      };
  
      // Add poll data if present
      if (toot.poll) {
        payload.poll = {
          options: toot.poll.options,
          expires_in: toot.poll.expires_in,
          multiple: toot.poll.multiple || false,
          hide_totals: toot.poll.hide_totals || false,
        };
      }
  
      // Use the statuses endpoint with scheduled_at parameter
      const response = await api.post(`${auth.instance}/api/v1/statuses`, payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Moves a scheduled toot to a new date. Mastodon only allows changing `scheduled_at` this way.
   * @param {string} id - The ID of the scheduled toot.
   * @param {string} scheduledAt - The new ISO 8601 date, at least 5 minutes in the future.
   * @returns {Promise<MastodonStatus>} The updated scheduled toot.
   * @throws {Error} If the instance URL is not set or the request fails.
   */
  async function rescheduleToot(id: string, scheduledAt: string): Promise<MastodonStatus> {
    if (!auth.instance) throw new Error('No instance URL set');

    try {
      const response = await api.put(`${auth.instance}/api/v1/scheduled_statuses/${encodeURIComponent(id)}`, {
        scheduled_at: scheduledAt,
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Tells whether a scheduled toot still exists, i.e. has not been published or deleted meanwhile.
   * @param {string} id - The ID of the scheduled toot.
   * @returns {Promise<boolean>} False when the instance answers 404.
   * @throws {Error} If the instance URL is not set or the request fails for another reason.
   */
  async function scheduledTootExists(id: string): Promise<boolean> {
    if (!auth.instance) throw new Error('No instance URL set');

    try {
      await api.get(`${auth.instance}/api/v1/scheduled_statuses/${encodeURIComponent(id)}`);
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return false;
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Sends a direct message to the user.
   * @param {string} message - The message content.
   * @returns {Promise<MastodonStatus>} The sent message data.
   * @throws {Error} If the request fails.
   */
  async function sendDirectMessageAsUser(message: string): Promise<MastodonStatus> {
    try {
      const response = await api.post(`${auth.instance}/api/v1/statuses`, {
        status: message,
        // 'direct': Only Mentioned Users
        visibility: 'direct',
      });
      console.log('Direct message sent:', response.data);
  
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Sends a direct thank you notification to the user.
   * @returns {Promise<void>} A promise that resolves when the notification is sent.
   */
  async function sendDirectThanksNotification(): Promise<void> {
    try {
      const thanksMessage = `🤗 ${auth.account?.display_name} is sending you a thank you! \nToday at ${new Date().toLocaleString()} \nCC: @dams@disabled.social`;
      await sendDirectMessageAsUser(thanksMessage);
    } catch (error) {
      console.error('Failed to send thanks notification:', error);
    }
  }

  /**
   * Uploads media to the Mastodon instance.
   * @param {File} file - The file to upload.
   * @param {(progress: number) => void} [onProgress] - Optional callback for progress updates.
   * @returns {Promise<MastodonMediaAttachment>} The uploaded media attachment data.
   */
  async function uploadMedia(file: File, onProgress?: (progress: number) => void): Promise<MastodonMediaAttachment> {
    if (!auth.instance) throw new Error('No instance URL set');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post<MastodonMediaAttachment>(`${auth.instance}/api/v2/media`, formData, {
        // Overrides the client's JSON default (axios would serialize the FormData to JSON otherwise);
        // in the browser axios then drops it so the browser sets the multipart boundary itself.
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: MEDIA_UPLOAD_TIMEOUT_MS,
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress((event.loaded / event.total) * 100);
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Updates the metadata for a media attachment.
   * @param {string} id - The ID of the media attachment.
   * @param {string} [description] - Optional description for the media.
   * @param {{ x: number; y: number }} [focus] - Optional focus coordinates for the media.
   * @returns {Promise<Object>} The updated media metadata.
   * @throws {Error} If the instance URL is not set.
   */
  async function updateMediaMetadata(id: string, description?: string, focus?: { x: number; y: number }) {
    if (!auth.instance) throw new Error('No instance URL set');
  
    const response = await api.put(`${auth.instance}/api/v1/media/${id}`, {
      description,
      focus,
    });
    return response.data;
  }

  /**
   * Retrieves all scheduled toots, following Mastodon's Link-header pagination.
   * @returns {Promise<MastodonStatus[]>} The list of scheduled toots.
   * @throws {Error} If the instance URL is not set or the request fails.
   */
  async function getScheduledToots(): Promise<MastodonStatus[]> {
    if (!auth.instance) throw new Error('No instance URL set');
    const instance = auth.instance;

    try {
      const toots: MastodonStatus[] = [];
      const visited = new Set<string>();
      let url: string | null = `${instance}/api/v1/scheduled_statuses?limit=${SCHEDULED_PAGE_SIZE}`;

      // Stop on the page cap, on a URL already visited or on an empty page, so a buggy
      // instance can neither loop nor duplicate toots.
      while (url && !visited.has(url) && visited.size < MAX_SCHEDULED_PAGES) {
        visited.add(url);
        const response = await api.get<MastodonStatus[]>(url);
        if (response.data.length === 0) break;
        toots.push(...response.data);
        const link = response.headers['link'];
        url = getNextPageUrl(typeof link === 'string' ? link : null, instance);
      }

      return toots;
    } catch (error) {
      console.error('Error fetching scheduled toots:', error);
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Deletes a scheduled toot by its ID.
   * @param {string} id - The ID of the scheduled toot to delete.
   * @returns {Promise<void>} A promise that resolves when the toot is deleted.
   * @throws {Error} If the request fails.
   */
  async function deleteScheduledToot(id: string): Promise<void> {
    if (!auth.instance) throw new Error('No instance URL set');

    try {
      await api.delete(`${auth.instance}/api/v1/scheduled_statuses/${encodeURIComponent(id)}`);
    } catch (err) {
      console.error('Error deleting scheduled toot:', err);
      throw new Error(handleApiError(err), { cause: err });
    }
  }

  return {
    /**
     * Registers a new application with the Mastodon instance.
     * @param {string} instanceUrl - The origin of the Mastodon instance.
     * @returns {Promise<{ client_id: string; client_secret: string }>} The app credentials.
     */
    registerApplication,
  
    /**
     * Exchanges the authorization code (and PKCE verifier) for an access token.
     * @param {string} instanceUrl - The instance origin.
     * @param {string} code - The authorization code.
     * @param {string} clientId - The client ID.
     * @param {string} clientSecret - The client secret.
     * @param {string} codeVerifier - The PKCE verifier.
     * @returns {Promise<{ access_token: string }>} The access token data.
     */
    getAccessToken,
  
    /**
     * Verifies the user's credentials with the Mastodon instance.
     * @returns {Promise<Object>} The verified account data.
     */
    verifyCredentials,
  
    /**
     * Schedules a toot to be posted at a later time.
     * @param {ScheduledToot} toot - The toot data including content and scheduling information.
     * @param {string} idempotencyKey - Unique key per draft, sent as the Idempotency-Key header.
     * @returns {Promise<MastodonStatus>} The scheduled toot data.
     */
    scheduleToot,

    /**
     * Moves a scheduled toot to a new date.
     * @param {string} id - The ID of the scheduled toot.
     * @param {string} scheduledAt - The new ISO 8601 date.
     * @returns {Promise<MastodonStatus>} The updated scheduled toot.
     */
    rescheduleToot,

    /**
     * Tells whether a scheduled toot still exists.
     * @param {string} id - The ID of the scheduled toot.
     * @returns {Promise<boolean>} False when it was published or deleted.
     */
    scheduledTootExists,
  
    /**
     * Sends a direct thank you notification to the user.
     * @returns {Promise<void>} A promise that resolves when the notification is sent.
     */
    sendDirectThanksNotification,
  
    /**
     * Uploads media to the Mastodon instance.
     * @param {File} file - The file to upload.
     * @param {(progress: number) => void} [onProgress] - Optional callback for progress updates.
     * @returns {Promise<MastodonMediaAttachment>} The uploaded media attachment data.
     */
    uploadMedia,
  
    /**
     * Updates the metadata for a media attachment.
     * @param {string} id - The ID of the media attachment.
     * @param {string} [description] - Optional description for the media.
     * @param {{ x: number; y: number }} [focus] - Optional focus coordinates for the media.
     * @returns {Promise<Object>} The updated media metadata.
     */
    updateMediaMetadata,
  
    /**
     * Retrieves all scheduled toots from the Mastodon instance, across all pages.
     * @returns {Promise<MastodonStatus[]>} The list of scheduled toots.
     */
    getScheduledToots,
  
    /**
     * Deletes a scheduled toot by its ID.
     * @param {string} id - The ID of the scheduled toot to delete.
     * @returns {Promise<void>} A promise that resolves when the toot is deleted.
     */
    deleteScheduledToot,
  };
}