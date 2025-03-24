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
    <header class="header">
      <h1 class="header-title winky-sans-900">Toots Scheduler</h1>
      <nav v-if="auth.accessToken" class="nav-buttons">
        <button 
          v-if="newFeatures.length > 0"
          @click="showWhatsNew = true"
          class="whats-new-button"
      >
          What's New
        </button>
        <button class="logout-button" @click="handleLogout">Logout</button>
      </nav>
    </header>

    <RouterView />

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
@import './assets/styles/fonts.css';

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  font-family: "Nunito Sans", sans-serif;
  line-height: 1.5;
  font-weight: 400;
  font-optical-sizing: auto;
  font-variation-settings:
    "wdth" 100,
    "YTLC" 500;

  color-scheme: light dark;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  position: fixed;
  width: 100%;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ddd;
  background-color: #fff;
  z-index: 10;
}

.nav-buttons {
  display: flex;
  gap: 0.5rem;
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

.header-title {
  font-size: 1.2rem;
}

.whats-new-button, .logout-button {
  background-color: #333;
  border: none;
  color: #fff;
  padding: 0.8rem 2rem;
  border-radius: 3rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.whats-new-button:hover, .logout-button:hover {
  font-weight: 700;
  background-color: #444;
}

</style>
