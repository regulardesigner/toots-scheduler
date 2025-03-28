<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useMastodonApi } from '../../composables/useMastodonApi';

const emit = defineEmits<{
  (e: 'close-child-modal'): void;
}>();

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
    emit('close-child-modal');
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="login-form">
    <h2 class="winky-sans-700">Instance Sign In</h2>
    <form @submit.prevent="handleLogin">
      <div class="form-group">
        <label for="instance">Enter your instance URL</label>
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
      <button type="submit" :disabled="isLoading" class="submit-button">
        {{ isLoading ? 'Connecting...' : 'Connect' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-form {
  max-width: 400px;
  margin: 0 auto;
}

h2 {
  font-size: 2rem;
  text-align: center;
  margin-bottom: 2rem;
  color: #333;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
  font-size: 0.9rem;
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

input:focus {
  outline: none;
  border-color: #555;
}

input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error {
  color: #e74c3c;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: #fde8e7;
  border-radius: 0.5rem;
  font-size: 0.9rem;
}

.submit-button {
  width: 100%;
  margin-top: 1rem;
  background-color: #333;
  border: none;
  color: #fff;
  padding: 1rem 3.6rem;
  border-radius: 3rem;
  font-size: 1rem;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  background-color: #444;
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style> 