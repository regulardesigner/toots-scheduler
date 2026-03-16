<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '../stores/auth';
import { useMastodonApi } from '../composables/useMastodonApi';

const router = useRouter();
const auth = useAuthStore();
const api = useMastodonApi();
const toast = useToast();

onMounted(async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      throw new Error('No authorization code found');
    }

    if (!auth.instance || !auth.clientId || !auth.clientSecret) {
      throw new Error('Missing authentication information');
    }

    // Exchange the code for an access token
    const tokenData = await api.getAccessToken(code, auth.clientId, auth.clientSecret);

    // Store the access token
    auth.setAccessToken(tokenData.access_token);

    // Get user account information
    const accountData = await api.verifyCredentials();
    auth.setAccount(accountData);

    // Redirect to composer
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
