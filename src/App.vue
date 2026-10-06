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

const auth = useAuthStore();
const featuresStore = useFeaturesStore();
const { newFeatures } = storeToRefs(featuresStore);
const showWhatsNew = ref(false);
const mastodonApi = useMastodonApi();
const isMenuOpen = ref(false);
const toast = useToast();

// Initialize session timeout
useSessionTimeout();

// Reads the instance's limits after every sign-in or restored session.
useInstanceStore();

const route = useRoute();
const router = useRouter();

async function handleLogout(): Promise<void> {
  isMenuOpen.value = false;
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
  showWhatsNew.value = false;
}

/** The "thank you" message awaiting confirmation; null when the dialog is closed. */
const thanksMessage = ref<string | null>(null);

function openThanks(): void {
  isMenuOpen.value = false;
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

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

const hasNewFeatures = computed(() => newFeatures.value.length > 0);
</script>

<template>
  <div class="app">
    <header class="header">
      <h1 class="header-title winky-sans-900">
        Toot Scheduler
      </h1>
      
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
      <div
        v-if="auth.accessToken"
        class="mobile-nav"
      >
        <span
          v-if="hasNewFeatures"
          class="notification-dot"
          :class="{ 'notification-dot--none': isMenuOpen }"
        />
        <span
          v-if="hasNewFeatures"
          class="whats-new-mobile-label"
          :class="{ 'whats-new-mobile-label--none': isMenuOpen }"
        >What's New</span>
        <button
          class="burger-menu"
          :class="{ 'is-open': isMenuOpen }"
          @click="toggleMenu"
        >
          <span />
          <span />
          <span />
        </button>
        <div
          class="mobile-menu"
          :class="{ 'is-open': isMenuOpen }"
        >
          <span class="mobile-menu-spacer">
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
              <Send class="thanks-button-icon" />
              Say Thanks
            </button>
          </span>
          <button
            class="logout-button"
            @click="handleLogout"
          >
            Logout
          </button>
        </div>
      </div>
    </header>

    <RouterView />

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

/* Mobile Navigation Styles */
.mobile-nav {
  position: relative;
  display: none;

}

.burger-menu {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.burger-menu span {
  display: block;
  width: 25px;
  height: 3px;
  border-radius: 5px;
  background-color: #333;
  transition: all 0.3s ease;
}

.notification-dot {
  position: absolute;
  top: 0.2rem;
  right: 0.2rem;
  width: 0.65rem;
  height: 0.65rem;
  background-color: #FF9200;
  border-radius: 50%;
  z-index: 10;
  pointer-events: none;
}

.whats-new-mobile-label {
  position: absolute;
  top: 0.4rem;
  right: 2.6rem;
  font-size: 0.65rem;
  font-weight: 700;
  color: #fff;
  background-color: #FF9200;
  padding: 0.2rem 0.5rem;
  border-radius: 0.5rem;
  z-index: 10;
  display: inline-block;
  text-wrap: nowrap;
  animation: enter-from-right-fade-in-and-out 3s ease forwards;
}

@keyframes enter-from-right-fade-in-and-out {
  0% {
    opacity: 0;
    transform: translateX(20%);
  }
  10%, 80% {
    opacity: 1;
    transform: translateX(0);
  }
  100% {
    opacity: 0;
  }
}

.notification-dot--none {
  display: none;
}

.burger-menu.is-open span:nth-child(1) {
  transform: translateY(9px) rotate(45deg);
}

.burger-menu.is-open span:nth-child(2) {
  opacity: 0;
}

.burger-menu.is-open span:nth-child(3) {
  transform: translateY(-9px) rotate(-45deg);
}

.mobile-menu {
  position: fixed;
  top: 60px;
  right: -100%;
  width: 100%;
  height: calc(100dvh - 60px);
  background-color: #f5f5f5;
  padding: 1rem;
  transition: right 0.3s ease;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
}

.mobile-menu-spacer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mobile-menu.is-open {
  right: 0;
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

  .mobile-nav {
    display: block;
  }
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
