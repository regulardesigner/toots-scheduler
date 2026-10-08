import axios from 'axios';
import { useAuthStore } from '../stores/auth';

/**
 * Tells whether a request URL is on the instance origin. A prefix check would also
 * match https://masto.example.evil.com, which must never receive the token.
 * @param {string | undefined} url - The request URL.
 * @param {string} instance - The instance origin.
 * @returns {boolean} True when the URL's origin is exactly the instance.
 */
function isInstanceUrl(url: string | undefined, instance: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).origin === instance;
  } catch {
    return false;
  }
}

/**
 * Creates the HTTP client for the Mastodon instance: it attaches the token to instance
 * requests only, and ends the session when the instance rejects the token (401).
 * @returns {import('axios').AxiosInstance} The configured client.
 */
export function createApiClient() {
  const api = axios.create({
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  api.interceptors.request.use(function(config) {
    const auth = useAuthStore();
    if (auth.accessToken && auth.instance && isInstanceUrl(config.url, auth.instance)) {
      config.headers.Authorization = `Bearer ${auth.accessToken}`;
    }
    return config;
  });

  api.interceptors.response.use(undefined, async function(error) {
    const auth = useAuthStore();
    if (
      axios.isAxiosError(error)
      && error.response?.status === 401
      && auth.instance
      && isInstanceUrl(error.config?.url, auth.instance)
      // A request sent with an older token (e.g. another tab switched account) says nothing about the current one.
      && error.config?.headers?.Authorization === `Bearer ${auth.accessToken}`
    ) {
      await auth.handleUnauthorized();
    }
    return Promise.reject(error);
  });

  return api;
}
