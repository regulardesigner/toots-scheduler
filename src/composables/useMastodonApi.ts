import axios from 'axios';
import { useAuthStore } from '../stores/auth';
import type { MastodonStatus, ScheduledToot, MastodonMediaAttachment } from '../types/mastodon';

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
        client_name: 'Toot Scheduler',
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
        scheduled_at: toot.scheduled_at,
        media_ids: toot.media_ids || [],
        visibility: toot.visibility || 'public',
        sensitive: toot.sensitive || false,
        spoiler_text: toot.spoiler_text || '',
        language: toot.language || null,
        // Add idempotency key to prevent duplicate posts
        idempotency: Date.now().toString(),
      };

      console.log('Scheduling toot with payload:', payload);

      // Use the statuses endpoint with scheduled_at parameter
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
      if (axios.isAxiosError(error)) {
        console.error('API Error Response:', error.response?.data);
        throw new Error(error.response?.data?.error || 'Failed to send direct message');
      }
      throw error;
    }
  }

  async function sendDirectThanksNotification(): Promise<void> {
    try {
      const thanksMessage = `🤗 ${auth.account?.display_name} is sending you a thank you! \nToday at ${new Date().toLocaleString()} \nCC: @dams@disabled.social`;
      await sendDirectMessageAsUser(thanksMessage);
    } catch (error) {
      console.error('Failed to send thanks notification:', error);
    }
  }

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
          } catch (error) {
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

  async function updateMediaMetadata(id: string, description?: string, focus?: { x: number; y: number }) {
    if (!auth.instance) throw new Error('No instance URL set');
    
    const response = await api.put(`${auth.instance}/api/v1/media/${id}`, {
      description,
      focus,
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

  async function deleteScheduledToot(id: string): Promise<void> {
    try {
      await api.delete(`${auth.instance}/api/v1/scheduled_statuses/${id}`);
    } catch (err) {
      console.error('Error deleting scheduled toot:', err);
      throw new Error('Failed to delete scheduled toot');
    }
  }

  return {
    registerApplication,
    getAccessToken,
    verifyCredentials,
    scheduleToot,
    sendDirectThanksNotification,
    uploadMedia,
    updateMediaMetadata,
    getScheduledToots,
    deleteScheduledToot,
  };
} 