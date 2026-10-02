import { createApiClient } from '../utils/api';
import { useAuthStore } from '../stores/auth';
import type { MastodonStatus, ScheduledToot, MastodonMediaAttachment } from '../types/mastodon';
import { normalizeUrl } from '../utils/url';
import { handleApiError } from '../utils/error';
import { getNextPageUrl } from '../utils/linkHeader';

/** Mastodon's maximum page size for scheduled statuses. */
const SCHEDULED_PAGE_SIZE = 40;
/** Safety cap: 10 pages × 40 = 400 toots, above Mastodon's 300 scheduled-toot limit. */
const MAX_SCHEDULED_PAGES = 10;

/**
 * Creates a composable for interacting with the Mastodon API.
 * @returns {Object} An object containing functions for Mastodon API operations.
 */
export function useMastodonApi() {
  const auth = useAuthStore();
  const api = createApiClient();

  /**
   * Registers a new application with the Mastodon instance.
   * @param {string} instanceUrl - The URL of the Mastodon instance.
   * @returns {Promise<Object>} The application data containing client_id and client_secret.
   * @throws {Error} If the registration fails or the response is invalid.
   */
  async function registerApplication(instanceUrl: string) {
    try {
      const normalizedUrl = normalizeUrl(instanceUrl);
      const response = await api.post(`${normalizedUrl}/api/v1/apps`, {
        client_name: 'Toot Scheduler',
        redirect_uris: window.location.origin + import.meta.env.BASE_URL + 'oauth/callback',
        scopes: 'read:accounts read:statuses write:media write:statuses',
        website: window.location.origin + import.meta.env.BASE_URL
      });
  
      if (!response.data.client_id || !response.data.client_secret) {
        throw new Error('Invalid response from server');
      }
  
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Gets an access token from the Mastodon instance using the authorization code.
   * @param {string} code - The authorization code.
   * @param {string} clientId - The client ID.
   * @param {string} clientSecret - The client secret.
   * @returns {Promise<Object>} The access token data.
   * @throws {Error} If the instance URL is not set or the request fails.
   */
  async function getAccessToken(code: string, clientId: string, clientSecret: string) {
    if (!auth.instance) throw new Error('No instance URL set');
  
    try {
      const response = await api.post(`${auth.instance}/oauth/token`, {
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: window.location.origin + import.meta.env.BASE_URL + 'oauth/callback',
        scope: 'read:accounts read:statuses write:media write:statuses'
      });
  
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
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
      throw new Error(handleApiError(error));
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
      throw new Error(handleApiError(error));
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
      throw new Error(handleApiError(error));
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
    const formData = new FormData();
    formData.append('file', file);
  
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
  
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });
  
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch {
            reject(new Error('Failed to parse response'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });
  
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });
  
      xhr.open('POST', `${auth.instance}/api/v2/media`);
      xhr.setRequestHeader('Authorization', `Bearer ${auth.accessToken}`);
      xhr.send(formData);
    });
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
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Deletes a scheduled toot by its ID.
   * @param {string} id - The ID of the scheduled toot to delete.
   * @returns {Promise<void>} A promise that resolves when the toot is deleted.
   * @throws {Error} If the request fails.
   */
  async function deleteScheduledToot(id: string): Promise<void> {
    try {
      await api.delete(`${auth.instance}/api/v1/scheduled_statuses/${id}`);
    } catch (err) {
      console.error('Error deleting scheduled toot:', err);
      throw new Error(handleApiError(err));
    }
  }

  return {
    /**
     * Registers a new application with the Mastodon instance.
     * @param {string} instanceUrl - The URL of the Mastodon instance.
     * @returns {Promise<Object>} The application data containing client_id and client_secret.
     */
    registerApplication,
  
    /**
     * Gets an access token from the Mastodon instance using the authorization code.
     * @param {string} code - The authorization code.
     * @param {string} clientId - The client ID.
     * @param {string} clientSecret - The client secret.
     * @returns {Promise<Object>} The access token data.
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