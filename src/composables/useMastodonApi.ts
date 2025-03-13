import axios from 'axios';
import { useAuthStore } from '../stores/auth';
import type { MastodonStatus, ScheduledToot } from '../types/mastodon';

export function useMastodonApi() {
  const auth = useAuthStore();

  const api = axios.create({
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add auth token to requests if available
  api.interceptors.request.use(function(config) {
    if (auth.accessToken) {
      config.headers.Authorization = `Bearer ${auth.accessToken}`;
    }
    return config;
  });

  function normalizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.origin;
    } catch {
      throw new Error('Invalid URL format');
    }
  }

  async function registerApplication(instanceUrl: string) {
    try {
      const normalizedUrl = normalizeUrl(instanceUrl);
      const response = await axios.post(`${normalizedUrl}/api/v1/apps`, {
        client_name: 'Toots Scheduler',
        redirect_uris: window.location.origin + import.meta.env.BASE_URL + 'oauth/callback',
        scopes: 'read:accounts read:statuses write:media write:statuses',
        website: window.location.origin + import.meta.env.BASE_URL
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });
      
      if (!response.data.client_id || !response.data.client_secret) {
        throw new Error('Invalid response from server');
      }
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to register application');
      }
      throw error;
    }
  }

  async function getAccessToken(code: string, clientId: string, clientSecret: string) {
    if (!auth.instance) throw new Error('No instance URL set');
    
    try {
      const response = await axios.post(`${auth.instance}/oauth/token`, {
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: window.location.origin + import.meta.env.BASE_URL + 'oauth/callback',
        scope: 'read:accounts read:statuses write:media write:statuses'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error_description || 'Failed to get access token');
      }
      throw error;
    }
  }

  async function verifyCredentials() {
    if (!auth.instance) throw new Error('No instance URL set');
    const response = await api.get(`${auth.instance}/api/v1/accounts/verify_credentials`);
    return response.data;
  }

  async function scheduleToot(toot: ScheduledToot): Promise<MastodonStatus> {
    if (!auth.instance) throw new Error('No instance URL set');
    
    try {
      if (!toot.status) {
        throw new Error('Status content is required');
      }

      // Format the request payload according to Mastodon API specs
      const payload = {
        status: toot.status,
        media_ids: toot.media_ids,
        scheduled_at: toot.scheduled_at,
        visibility: toot.visibility,
        sensitive: toot.sensitive,
        spoiler_text: toot.spoiler_text,
        language: toot.language,
      };

      console.log('Scheduling toot with payload:', payload);

      const response = await api.post(`${auth.instance}/api/v1/statuses`, payload);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('API Error Response:', error.response?.data);
        const errorMessage = error.response?.data?.error || 'Failed to schedule toot';
        throw new Error(errorMessage);
      }
      throw error;
    }
  }

  async function uploadMedia(file: File) {
    if (!auth.instance) throw new Error('No instance URL set');
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`${auth.instance}/api/v2/media`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async function getScheduledToots() {
    if (!auth.instance) throw new Error('No instance URL set');
    try {
      const response = await api.get(`${auth.instance}/api/v1/scheduled_statuses`);
      console.log('Scheduled toots response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching scheduled toots:', error);
      throw error;
    }
  }

  async function deleteScheduledToot(id: string) {
    if (!auth.instance) throw new Error('No instance URL set');
    await api.delete(`${auth.instance}/api/v1/scheduled_statuses/${id}`);
  }

  return {
    registerApplication,
    getAccessToken,
    verifyCredentials,
    scheduleToot,
    uploadMedia,
    getScheduledToots,
    deleteScheduledToot,
  };
} 