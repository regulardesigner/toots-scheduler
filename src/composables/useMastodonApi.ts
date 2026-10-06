import axios from 'axios';
import { z } from 'zod';
import { createApiClient } from '../utils/api';
import { useAuthStore } from '../stores/auth';
import type { InstanceConfiguration, MastodonAccount, MastodonStatus, ScheduledToot, MastodonMediaAttachment } from '../types/mastodon';
import {
  AccountSchema,
  AppRegistrationSchema,
  InstanceSchema,
  InstanceV1Schema,
  MediaAttachmentSchema,
  ScheduledStatusSchema,
  TokenResponseSchema,
  parseApiResponse,
} from '../schemas/mastodon';
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

      return parseApiResponse(AppRegistrationSchema, response.data, 'app registration');
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

      return parseApiResponse(TokenResponseSchema, response.data, 'token response');
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Verifies the user's credentials with the Mastodon instance.
   * @returns {Promise<MastodonAccount>} The verified account data.
   * @throws {Error} If the instance URL is not set, the request fails or the account is malformed.
   */
  async function verifyCredentials(): Promise<MastodonAccount> {
    if (!auth.instance) throw new Error('No instance URL set');
    try {
      const response = await api.get(`${auth.instance}/api/v1/accounts/verify_credentials`);
      return parseApiResponse(AccountSchema, response.data, 'account');
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Reads the limits of the signed-in instance (GET /api/v2/instance, Mastodon 4.0+; falls back to /api/v1/instance for older Mastodon, Pleroma and Akkoma).
   * The endpoint is public; the shared client still sends the token only to this instance.
   * @returns {Promise<InstanceConfiguration>} The limits it reported; missing or invalid ones are left out.
   * @throws {Error} If the instance URL is not set, the request fails or the body is not an object.
   */
  async function getInstanceConfiguration(): Promise<InstanceConfiguration> {
    if (!auth.instance) throw new Error('No instance URL set');
    try {
      try {
        const response = await api.get(`${auth.instance}/api/v2/instance`);
        return parseApiResponse(InstanceSchema, response.data, 'instance information');
      } catch (error) {
        // Not signed in or not allowed: the older endpoint would say the same. Anything else
        // (404 on older Mastodon, Pleroma, Akkoma...) is worth a second try.
        if (axios.isAxiosError(error) && error.response?.status === 401) throw error;
        const response = await api.get(`${auth.instance}/api/v1/instance`);
        return parseApiResponse(InstanceV1Schema, response.data, 'instance information');
      }
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Schedules a toot to be posted at a later time.
   * @param {ScheduledToot} toot - The toot data including content and scheduling information.
   * @param {string} idempotencyKey - Unique key per draft; Mastodon ignores a resubmission with the same key for 1 hour.
   * @returns {Promise<void>} Resolves once the instance accepted it.
   * @throws {Error} If the instance URL is not set or the request fails.
   */
  async function scheduleToot(toot: ScheduledToot, idempotencyKey: string): Promise<void> {
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
      await api.post(`${auth.instance}/api/v1/statuses`, payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Moves a scheduled toot to a new date. Mastodon only allows changing `scheduled_at` this way.
   * @param {string} id - The ID of the scheduled toot.
   * @param {string} scheduledAt - The new ISO 8601 date, at least 5 minutes in the future.
   * @returns {Promise<void>} Resolves once the instance accepted it.
   * @throws {Error} If the instance URL is not set or the request fails.
   */
  async function rescheduleToot(id: string, scheduledAt: string): Promise<void> {
    if (!auth.instance) throw new Error('No instance URL set');

    try {
      await api.put(`${auth.instance}/api/v1/scheduled_statuses/${encodeURIComponent(id)}`, {
        scheduled_at: scheduledAt,
      });
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
   * Sends the "thank you" direct message, exactly as previewed to the user.
   * @param {string} message - The message, which mentions its recipient.
   * @returns {Promise<void>} Resolves once the instance accepted the message.
   * @throws {Error} If the request fails, so the UI can tell the user.
   */
  async function sendThanks(message: string): Promise<void> {
    if (!auth.instance) throw new Error('No instance URL set');

    try {
      await api.post(`${auth.instance}/api/v1/statuses`, {
        status: message,
        // 'direct': only the mentioned account sees it
        visibility: 'direct',
      });
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
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
      const response = await api.post(`${auth.instance}/api/v2/media`, formData, {
        // Overrides the client's JSON default (axios would serialize the FormData to JSON otherwise);
        // in the browser axios then drops it so the browser sets the multipart boundary itself.
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: MEDIA_UPLOAD_TIMEOUT_MS,
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress((event.loaded / event.total) * 100);
        },
      });
      return parseApiResponse(MediaAttachmentSchema, response.data, 'media attachment');
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Updates the metadata for a media attachment.
   * @param {string} id - The ID of the media attachment.
   * @param {string} [description] - Optional description for the media.
   * @param {{ x: number; y: number }} [focus] - Optional focus coordinates for the media.
   * @returns {Promise<MastodonMediaAttachment>} The updated media attachment.
   * @throws {Error} If the instance URL is not set, the request fails or the response is malformed.
   */
  async function updateMediaMetadata(id: string, description?: string, focus?: { x: number; y: number }): Promise<MastodonMediaAttachment> {
    if (!auth.instance) throw new Error('No instance URL set');

    try {
      const response = await api.put(`${auth.instance}/api/v1/media/${encodeURIComponent(id)}`, {
        description,
        focus,
      });
      return parseApiResponse(MediaAttachmentSchema, response.data, 'media attachment');
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
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
        const response = await api.get(url);
        const page = parseApiResponse(z.array(ScheduledStatusSchema), response.data, 'scheduled toots');
        if (page.length === 0) break;
        // Validated shape; MastodonStatus is the app's (looser) view of a scheduled status.
        toots.push(...(page as unknown as MastodonStatus[]));
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
     * Reads the limits of the signed-in instance.
     * @returns {Promise<InstanceConfiguration>} The limits it reported.
     */
    getInstanceConfiguration,
  
    /**
     * Schedules a toot to be posted at a later time.
     * @param {ScheduledToot} toot - The toot data including content and scheduling information.
     * @param {string} idempotencyKey - Unique key per draft, sent as the Idempotency-Key header.
     * @returns {Promise<void>} Resolves once the instance accepted it.
     */
    scheduleToot,

    /**
     * Moves a scheduled toot to a new date.
     * @param {string} id - The ID of the scheduled toot.
     * @param {string} scheduledAt - The new ISO 8601 date.
     * @returns {Promise<void>} Resolves once the instance accepted it.
     */
    rescheduleToot,

    /**
     * Tells whether a scheduled toot still exists.
     * @param {string} id - The ID of the scheduled toot.
     * @returns {Promise<boolean>} False when it was published or deleted.
     */
    scheduledTootExists,
  
    /**
     * Sends the previewed "thank you" direct message.
     * @param {string} message - The message.
     * @returns {Promise<void>} Resolves once sent.
     */
    sendThanks,
  
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