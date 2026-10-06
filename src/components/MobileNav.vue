<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import Send from './icons/Send.vue';

/** What a menu item asks the app to do. */
type MenuAction = 'whats-new' | 'thanks' | 'logout';

defineProps<{
  hasNewFeatures: boolean;
}>();

const emit = defineEmits<{
  (e: MenuAction): void;
}>();

const isOpen = ref(false);
const menuButton = ref<HTMLButtonElement | null>(null);
const root = ref<HTMLElement | null>(null);

function toggle(): void {
  isOpen.value = !isOpen.value;
}

function closeAndFocusButton(): void {
  isOpen.value = false;
  menuButton.value?.focus();
}

function choose(action: MenuAction): void {
  // Focus moves to the menu button first: a dialog opened next gives focus back there, not to a hidden item.
  closeAndFocusButton();
  emit(action);
}

/** Tab past the last item (or a click elsewhere) must not leave the menu open over the page. A null target (blank panel, a dialog taking focus) keeps it. */
function handleFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget as Node | null;
  if (isOpen.value && next && !root.value?.contains(next)) isOpen.value = false;
}

function handleKeydown(event: KeyboardEvent): void {
  // An open dialog owns Escape (its own document listener closes it); one press must not close both.
  if (event.key !== 'Escape' || event.defaultPrevented || document.body.classList.contains('modal-open')) return;
  closeAndFocusButton();
}

// Escape is only listened to while the menu is open.
watch(isOpen, (open) => {
  if (open) document.addEventListener('keydown', handleKeydown);
  else document.removeEventListener('keydown', handleKeydown);
});

onUnmounted(() => document.removeEventListener('keydown', handleKeydown));
</script>

<template>
  <nav
    ref="root"
    class="mobile-nav"
    aria-label="Account"
    @focusout="handleFocusOut"
  >
    <span
      v-if="hasNewFeatures"
      class="notification-dot"
      :class="{ 'notification-dot--none': isOpen }"
      aria-hidden="true"
    />
    <span
      v-if="hasNewFeatures"
      class="whats-new-mobile-label"
      aria-hidden="true"
    >What's New</span>
    <button
      ref="menuButton"
      type="button"
      class="burger-menu"
      :class="{ 'is-open': isOpen }"
      aria-label="Menu"
      aria-controls="mobile-menu"
      :aria-expanded="isOpen ? 'true' : 'false'"
      @click="toggle"
    >
      <span />
      <span />
      <span />
    </button>
    <div
      id="mobile-menu"
      class="mobile-menu"
      :class="{ 'is-open': isOpen }"
    >
      <span class="mobile-menu-spacer">
        <button
          v-if="hasNewFeatures"
          type="button"
          class="whats-new-button"
          @click="choose('whats-new')"
        >
          What's New
        </button>
        <button
          type="button"
          class="thanks-button"
          @click="choose('thanks')"
        >
          <Send class="thanks-button-icon" />
          Say Thanks
        </button>
      </span>
      <button
        type="button"
        class="logout-button"
        @click="choose('logout')"
      >
        Logout
      </button>
    </div>
  </nav>
</template>

<style scoped>
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
  color: #333;
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

/* Closed: off-screen and hidden, so neither Tab nor a screen reader reaches its items. */
.mobile-menu {
  position: fixed;
  top: 60px;
  right: -100%;
  width: 100%;
  height: calc(100dvh - 60px);
  background-color: #f5f5f5;
  padding: 1rem;
  visibility: hidden;
  transition: right 0.3s ease, visibility 0s linear 0.3s;
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
  visibility: visible;
  transition: right 0.3s ease;
}

@media (prefers-reduced-motion: reduce) {
  .mobile-menu,
  .mobile-menu.is-open,
  .burger-menu span {
    transition: none;
  }

  .whats-new-mobile-label {
    animation: none;
  }
}

@media (max-width: 768px) {
  .mobile-nav {
    display: block;
  }
}
</style>
