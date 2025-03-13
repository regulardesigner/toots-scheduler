<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useMastodonApi } from '../composables/useMastodonApi';

const router = useRouter();
const auth = useAuthStore();
const api = useMastodonApi();
const error = ref('');

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

    // Redirect to home
    router.push({ name: 'home' });
  } catch (err) {
    console.error('OAuth callback error:', err);
    error.value = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
    setTimeout(() => {
      router.push({ name: 'login' });
    }, 3000);
  }
});
</script>

<template>
  <div class="oauth-callback">
    <div class="loading">
      <p v-if="error" class="error">{{ error }}</p>
      <p v-else>Authenticating...</p>
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

.error {
  color: red;
}
</style> 