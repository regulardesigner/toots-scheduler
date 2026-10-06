<script setup lang="ts">
import { RouterView } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useSessionTimeout } from './composables/useSessionTimeout';
import { useFeaturesStore } from './stores/features';
import { useInstanceStore } from './stores/instance';
import { storeToRefs } from 'pinia';
import { ref, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMastodonApi } from './composables/useMastodonApi';
import { useToast } from 'vue-toastification';

import WhatsNew from './components/Modals/WhatsNew.vue';
import ThanksConfirmModal from './components/Modals/ThanksConfirmModal.vue';
import { buildThanksMessage } from './utils/thanks';
import ModalView from './components/Modals/ModalView.vue';
import Send from './components/icons/Send.vue';
import MobileNav from './components/MobileNav.vue';

const auth = useAuthStore();
const featuresStore = useFeaturesStore();
const { newFeatures } = storeToRefs(featuresStore);
const showWhatsNew = ref(false);
const mastodonApi = useMastodonApi();
const toast = useToast();

// Initialize session timeout
useSessionTimeout();

// Reads the instance's limits after every sign-in or restored session.
useInstanceStore();

const route = useRoute();
const router = useRouter();

async function handleLogout(): Promise<void> {
  await auth.logout();
  toast.success('You have been logged out successfully.');
}

// Whatever ended the session (logout, inactivity, rejected token, another tab), leave protected pages.
watch(() => auth.accessToken, (token) => {
  if (!token && route.meta.requiresAuth) {
    router.push({ name: 'home' });
  }
});

watch(() => auth.sessionEndReason, (reason) => {
  if (!reason) return;
  // The toast container mounts on the next tick after app.use(Toast): a toast emitted
  // during startup (expired session) would otherwise be lost.
  void nextTick(() => {
    if (reason === 'inactivity') {
      toast.info("You've been signed out after 30 minutes of inactivity.");
    } else {
      toast.warning('Your session is no longer valid. Please sign in again.');
    }
  });
  auth.acknowledgeSessionEnd();
}, { immediate: true });

function handleWhatsNewClose() {
  // Escape, the close button and the overlay count as having seen it (a no-op repeat after WhatsNew's own button).
  featuresStore.markFeaturesAsSeen();
  showWhatsNew.value = false;
}

/** The "thank you" message awaiting confirmation; null when the dialog is closed. */
const thanksMessage = ref<string | null>(null);

function openThanks(): void {
  const sender = auth.account?.display_name || auth.account?.acct || 'Someone';
  thanksMessage.value = buildThanksMessage(sender, new Date());
}

function cancelThanks(): void {
  thanksMessage.value = null;
}

async function confirmThanks(): Promise<void> {
  const message = thanksMessage.value;
  thanksMessage.value = null; // closes the dialog and prevents a second send
  if (!message) return;

  try {
    await mastodonApi.sendThanks(message);
    toast.success('Thanks sent successfully! 🤗');
  } catch (error) {
    const reason = error instanceof Error && error.message ? error.message.replace(/\.+$/, '') : 'unknown error';
    toast.error(`Failed to send thanks: ${reason}.`);
  }
}

const hasNewFeatures = computed(() => newFeatures.value.length > 0);
</script>

<template>
  <div class="app">
    <header class="header">
      <!-- The app name, not a heading: each page has its own main heading. -->
      <p class="header-title winky-sans-900">
        Toot Scheduler
      </p>
      
      <!-- Desktop Navigation -->
      <nav
        v-if="auth.accessToken"
        class="nav-buttons desktop-nav"
      >
        <button 
          v-if="hasNewFeatures"
          class="whats-new-button"
          @click="showWhatsNew = true"
        >
          What's New
        </button>
        <button
          class="thanks-button"
          @click="openThanks"
        >
          <Send class="thanks-button-icon" />Say Thanks
        </button>
        <button
          class="logout-button"
          @click="handleLogout"
        >
          Logout
        </button>
      </nav>

      <!-- Mobile Burger Menu -->
      <MobileNav
        v-if="auth.accessToken"
        :has-new-features="hasNewFeatures"
        @whats-new="showWhatsNew = true"
        @thanks="openThanks"
        @logout="handleLogout"
      />
    </header>

    <main class="app-main">
      <RouterView />
    </main>

    <footer>
      <p>&copy; {{ new Date().getFullYear() }} Toot Scheduler</p>
    </footer>

    <ModalView
      :is-open="showWhatsNew"
      labelled-by="whats-new-title"
      @close="handleWhatsNewClose"
    >
      <WhatsNew @close="handleWhatsNewClose" />
    </ModalView>

    <ModalView
      :is-open="thanksMessage !== null"
      labelled-by="thanks-title"
      @close="cancelThanks"
    >
      <ThanksConfirmModal
        :message="thanksMessage ?? ''"
        @confirm="confirmThanks"
        @cancel="cancelThanks"
      />
    </ModalView>
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

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Hidden on screen, still read by screen readers (labels of icon-only controls, live regions). */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
  gap: 0.8rem;
}

/* Desktop Navigation Styles */
.desktop-nav {
  display: flex;
}

/* Responsive Styles */
@media (max-width: 768px) {
  .desktop-nav {
    display: none;
  }
}

.app-main {
  flex: 1;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.header-title {
  font-size: 1.2rem;
}

.thanks-button-icon {
  width: 1.2rem;
  height: 1.2rem;
}

.whats-new-button, .logout-button, .thanks-button {
  background-color: #333;
  border: none;
  color: #fff;
  padding: 0.6rem 2rem;
  border-radius: 3rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background-color 0.2s ease;
  width: 100%;
  text-wrap: nowrap;
}

.thanks-button {
  padding-left: 1.2rem;
}

.whats-new-button {
  background-color: #FF9200;
  color: #333;
}

.whats-new-button:hover {
  background-color: #f99e27;
  font-weight: 700;
  color: #333;
}

.logout-button:hover, .thanks-button:hover {
  font-weight: 700;
  background-color: #444;
}
</style>
