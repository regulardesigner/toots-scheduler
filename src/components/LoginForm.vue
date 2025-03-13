<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useMastodonApi } from '../composables/useMastodonApi';

const instance = ref('');
const auth = useAuthStore();
const api = useMastodonApi();
const error = ref('');
const isLoading = ref(false);

function normalizeInstanceUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.origin;
  } catch {
    throw new Error('Invalid URL format');
  }
}

async function handleLogin() {
  try {
    error.value = '';
    isLoading.value = true;
    
    // Normalize and validate the instance URL
    const normalizedUrl = normalizeInstanceUrl(instance.value);
    
    // Store the instance URL
    auth.setInstance(normalizedUrl);
    
    // Register the application with the instance
    const appData = await api.registerApplication(normalizedUrl);
    auth.setClientCredentials(appData.client_id, appData.client_secret);
    
    // Redirect to Mastodon OAuth page
    const params = new URLSearchParams({
      client_id: appData.client_id,
      redirect_uri: window.location.origin + import.meta.env.BASE_URL + 'oauth/callback',
      response_type: 'code',
      scope: 'read:accounts read:statuses write:media write:statuses',
    });

    window.location.href = `${normalizedUrl}/oauth/authorize?${params.toString()}`;
  } catch (err) {
    console.error('Login error:', err);
    error.value = err instanceof Error ? err.message : 'Failed to connect to Mastodon instance. Please check the URL and try again.';
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="login-form">
    <h2>Connect to Mastodon</h2>
    <form @submit.prevent="handleLogin">
      <div>
        <label for="instance">Mastodon Instance URL</label>
        <input
          id="instance"
          v-model="instance"
          type="url"
          placeholder="https://mastodon.social"
          required
          pattern="https?://.*"
          :disabled="isLoading"
        />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="isLoading">
        {{ isLoading ? 'Connecting...' : 'Connect' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-form {
  max-width: 400px;
  margin: 2rem auto;
  padding: 1rem;
}

form {
  margin-top: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
}

input {
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 1rem;
}

input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

button {
  width: 100%;
  padding: 0.5rem;
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error {
  color: red;
  margin-bottom: 1rem;
}
</style> 