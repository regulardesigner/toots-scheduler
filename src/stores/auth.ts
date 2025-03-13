import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import type { MastodonAccount } from '../types/mastodon';

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter();
  const accessToken = ref<string | null>(null);
  const account = ref<MastodonAccount | null>(null);
  const instance = ref<string | null>(null);
  const clientId = ref<string | null>(null);
  const clientSecret = ref<string | null>(null);

  function setAccessToken(token: string): void {
    accessToken.value = token;
    localStorage.setItem('mastodon_token', token);
  }

  function setInstance(instanceUrl: string): void {
    instance.value = instanceUrl;
    localStorage.setItem('mastodon_instance', instanceUrl);
  }

  function setClientCredentials(id: string, secret: string): void {
    clientId.value = id;
    clientSecret.value = secret;
    localStorage.setItem('mastodon_client_id', id);
    localStorage.setItem('mastodon_client_secret', secret);
  }

  function setAccount(accountData: MastodonAccount): void {
    account.value = accountData;
  }

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

    // Redirect to login page
    await router.push({ name: 'login' });
  }

  // Initialize from localStorage
  function initializeFromStorage(): void {
    const storedToken = localStorage.getItem('mastodon_token');
    const storedInstance = localStorage.getItem('mastodon_instance');
    const storedClientId = localStorage.getItem('mastodon_client_id');
    const storedClientSecret = localStorage.getItem('mastodon_client_secret');
    
    if (storedToken) accessToken.value = storedToken;
    if (storedInstance) instance.value = storedInstance;
    if (storedClientId) clientId.value = storedClientId;
    if (storedClientSecret) clientSecret.value = storedClientSecret;
  }

  // Initialize on store creation
  initializeFromStorage();

  return {
    // State
    accessToken,
    account,
    instance,
    clientId,
    clientSecret,
    // Actions
    setAccessToken,
    setInstance,
    setClientCredentials,
    setAccount,
    logout,
  };
}); 