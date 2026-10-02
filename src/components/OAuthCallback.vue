<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '../stores/auth';
import { useMastodonApi } from '../composables/useMastodonApi';
import { readAuthorizationCode, takePendingLogin } from '../utils/oauthFlow';

const router = useRouter();
const auth = useAuthStore();
const api = useMastodonApi();
const toast = useToast();

onMounted(async () => {
  const search = window.location.search;
  const pending = takePendingLogin();
  // The authorization code is single-use: remove it from the address bar and history.
  window.history.replaceState(window.history.state, '', window.location.pathname);

  try {
    if (!pending) {
      throw new Error('Sign-in was started in another tab or has expired. Please sign in again.');
    }

    const code = readAuthorizationCode(search, pending.state);
    const tokenData = await api.getAccessToken(
      pending.instance,
      code,
      pending.clientId,
      pending.clientSecret,
      pending.codeVerifier,
    );

    auth.completeLogin({
      instance: pending.instance,
      clientId: pending.clientId,
      clientSecret: pending.clientSecret,
      accessToken: tokenData.access_token,
    });
    auth.setAccount(await api.verifyCredentials());

    router.push({ name: 'composer' });
  } catch (err) {
    console.error('OAuth callback error:', err);
    toast.error(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    router.push({ name: 'home' });
  }
});
</script>

<template>
  <div class="oauth-callback">
    <div class="loading">
      <p>Authenticating...</p>
    </div>
  </div>
</template>

<style scoped>
.oauth-callback {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.loading {
  text-align: center;
}
</style>
