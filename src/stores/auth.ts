import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import type { MastodonAccount } from '../types/mastodon';

/**
 * Creates a Pinia store for authentication.
 * @returns {Object} The authentication store with state and actions.
 */
export const useAuthStore = defineStore('auth', () => {
  const router = useRouter();
  const accessToken = ref<string | null>(null);
  const account = ref<MastodonAccount | null>(null);
  const instance = ref<string | null>(null);
  const clientId = ref<string | null>(null);
  const clientSecret = ref<string | null>(null);

  /**
   * Sets the access token and stores it in localStorage.
   * @param {string} token - The access token.
   */
  function setAccessToken(token: string): void {
    accessToken.value = token;
    localStorage.setItem('mastodon_token', token);
  }

  /**
   * Sets the Mastodon instance URL and stores it in localStorage.
   * @param {string} instanceUrl - The Mastodon instance URL.
   */
  function setInstance(instanceUrl: string): void {
    instance.value = instanceUrl;
    localStorage.setItem('mastodon_instance', instanceUrl);
  }

  /**
   * Sets the client credentials and stores them in localStorage.
   * @param {string} id - The client ID.
   * @param {string} secret - The client secret.
   */
  function setClientCredentials(id: string, secret: string): void {
    clientId.value = id;
    clientSecret.value = secret;
    localStorage.setItem('mastodon_client_id', id);
    localStorage.setItem('mastodon_client_secret', secret);
  }

  /**
   * Sets the user account data.
   * @param {MastodonAccount} accountData - The account data.
   */
  function setAccount(accountData: MastodonAccount): void {
    account.value = accountData;
  }

  /**
   * Logs out the user by clearing authentication data and redirecting to the home page.
   * @returns {Promise<void>} A promise that resolves when the logout is complete.
   */
  async function logout(): Promise<void> {
    accessToken.value = null;
    account.value = null;
    instance.value = null;
    clientId.value = null;
    clientSecret.value = null;
    localStorage.removeItem('mastodon_token');
    localStorage.removeItem('mastodon_instance');
    localStorage.removeItem('mastodon_client_id');
    localStorage.removeItem('mastodon_client_secret');
  
    // Redirect to home page (landing page)
    await router.push({ name: 'home' });
  }

  // Initialize from localStorage
  /**
   * Initializes the authentication state from localStorage.
   */
  function initializeFromStorage(): void {
    const storedToken = localStorage.getItem('mastodon_token');
    const storedInstance = localStorage.getItem('mastodon_instance');
    const storedClientId = localStorage.getItem('mastodon_client_id');
    const storedClientSecret = localStorage.getItem('mastodon_client_secret');
  
    if (storedToken) accessToken.value = storedToken;
    if (storedInstance) instance.value = storedInstance;
    if (storedClientId) clientId.value = storedClientId;
    if (storedClientSecret) clientSecret.value = storedClientSecret;
  
    // If we have a token on initialization, redirect to composer
    if (storedToken) {
      router.push({ name: 'composer' });
    }
  }

  // Initialize on store creation
  initializeFromStorage();

  return {
    // State
    /**
     * The access token for authenticated API requests.
     * @type {Ref<string | null>}
     */
    accessToken,
  
    /**
     * The authenticated user's account data.
     * @type {Ref<MastodonAccount | null>}
     */
    account,
  
    /**
     * The URL of the Mastodon instance.
     * @type {Ref<string | null>}
     */
    instance,
  
    /**
     * The client ID for OAuth authentication.
     * @type {Ref<string | null>}
     */
    clientId,
  
    /**
     * The client secret for OAuth authentication.
     * @type {Ref<string | null>}
     */
    clientSecret,
  
    // Actions
    /**
     * Sets the access token.
     * @param {string} token - The access token.
     */
    setAccessToken,
  
    /**
     * Sets the Mastodon instance URL.
     * @param {string} instanceUrl - The Mastodon instance URL.
     */
    setInstance,
  
    /**
     * Sets the client credentials.
     * @param {string} id - The client ID.
     * @param {string} secret - The client secret.
     */
    setClientCredentials,
  
    /**
     * Sets the user account data.
     * @param {MastodonAccount} accountData - The account data.
     */
    setAccount,
  
    /**
     * Logs out the user.
     * @returns {Promise<void>} A promise that resolves when the logout is complete.
     */
    logout,
  };
}); 