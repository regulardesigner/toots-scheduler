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

  // Visiting the callback again (Back button, bookmark, stray link) while signed in must not touch the session.
  if (!pending && auth.accessToken) {
    router.replace({ name: 'composer' });
    return;
  }

  let createdToken: string | null = null;

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
    createdToken = tokenData.access_token;

    auth.completeLogin({
      instance: pending.instance,
      clientId: pending.clientId,
      clientSecret: pending.clientSecret,
      accessToken: tokenData.access_token,
    });
    auth.setAccount(await api.verifyCredentials());

    router.replace({ name: 'composer' });
  } catch (err) {
    // A half-finished sign-in must not leave a stored session behind (the token is revoked).
    // Only undo the session this callback created; never sign out an existing one.
    if (createdToken && auth.accessToken === createdToken) void auth.logout(); // local clear is immediate; don't wait for the revoke
    console.error('OAuth callback error:', err);
    toast.error(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    router.replace({ name: 'home' });
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
