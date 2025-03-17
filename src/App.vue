<script setup lang="ts">
import { RouterView } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useSessionTimeout } from './composables/useSessionTimeout';
import { useFeaturesStore } from './stores/features';
import { storeToRefs } from 'pinia';
import WhatsNew from './components/WhatsNew.vue';
import { ref } from 'vue';

const auth = useAuthStore();
const featuresStore = useFeaturesStore();
const { newFeatures } = storeToRefs(featuresStore);
const showWhatsNew = ref(false);

// Initialize session timeout
useSessionTimeout();

async function handleLogout(): Promise<void> {
  await auth.logout();
}

function handleWhatsNewClose() {
  showWhatsNew.value = false;
}
</script>

<template>
  <div class="app">
    <header>
      <h1>Toots Scheduler</h1>
      <nav v-if="auth.accessToken">
        <button 
          v-if="newFeatures.length > 0"
          @click="showWhatsNew = true"
          class="whats-new-button"
        >
          What's New
        </button>
        <button @click="handleLogout">Logout</button>
      </nav>
    </header>

    <main>
      <RouterView />
    </main>

    <footer>
      <p>&copy; {{ new Date().getFullYear() }} Toots Scheduler</p>
    </footer>

    <WhatsNew
      v-if="showWhatsNew"
      @close="handleWhatsNewClose"
    />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, system-ui, sans-serif;
  line-height: 1.5;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ddd;
}

main {
  flex: 1;
  padding: 2rem 1rem;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

footer {
  padding: 1rem;
  text-align: center;
  border-top: 1px solid #ddd;
}

button {
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.whats-new-button {
  background-color: #4CAF50;
  color: white;
  border: 1px solid #4CAF50;
  margin-right: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.whats-new-button:hover {
  background-color: #45a049;
}
</style>
