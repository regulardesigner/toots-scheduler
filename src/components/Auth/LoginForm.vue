<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useMastodonApi } from '../../composables/useMastodonApi';
import { normalizeUrl } from '../../utils/url';
import { createPkcePair, createRandomToken } from '../../utils/pkce';
import { buildAuthorizeUrl, savePendingLogin } from '../../utils/oauthFlow';
import { logError } from '../../utils/logError';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const instance = ref('');
const instanceInput = ref<HTMLInputElement | null>(null);
const api = useMastodonApi();
const error = ref('');
const isLoading = ref(false);

async function handleLogin() {
  try {
    error.value = '';
    isLoading.value = true;

    const instanceUrl = normalizeUrl(instance.value);
    const appData = await api.registerApplication(instanceUrl);
    const state = createRandomToken();
    const { verifier, challenge } = await createPkcePair();

    // Kept for this tab only, until the instance redirects back to /oauth/callback.
    savePendingLogin({
      instance: instanceUrl,
      clientId: appData.client_id,
      clientSecret: appData.client_secret,
      state,
      codeVerifier: verifier,
    });

    emit('close');
    window.location.assign(buildAuthorizeUrl(instanceUrl, appData.client_id, state, challenge));
  } catch (err) {
    logError('Login error', err);
    error.value = err instanceof Error ? err.message : 'Failed to connect to Mastodon instance. Please check the URL and try again.';
  } finally {
    isLoading.value = false;
  }
  // The field was disabled while loading, which dropped focus; put it back after a failed attempt.
  if (error.value) {
    await nextTick();
    instanceInput.value?.focus();
  }
}
</script>

<template>
  <div class="login-form">
    <h2
      id="login-title"
      class="winky-sans-700"
    >
      Instance Sign In
    </h2>
    <form @submit.prevent="handleLogin">
      <div class="form-group">
        <label for="instance">Enter your instance address</label>
        <input
          id="instance"
          ref="instanceInput"
          v-model="instance"
          type="text"
          inputmode="url"
          autocapitalize="none"
          autocomplete="url"
          spellcheck="false"
          placeholder="mastodon.social"
          required
          :disabled="isLoading"
          :aria-invalid="error ? 'true' : undefined"
          :aria-describedby="error ? 'login-error' : undefined"
        >
      </div>
      <!-- Always in the DOM, only its content changes: Safari ignores an alert inserted already filled. -->
      <div
        id="login-error"
        role="alert"
      >
        <p
          v-if="error"
          class="error"
        >
          {{ error }}
        </p>
      </div>
      <button
        type="submit"
        :disabled="isLoading"
        class="submit-button"
      >
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
  color: #c0392b;
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