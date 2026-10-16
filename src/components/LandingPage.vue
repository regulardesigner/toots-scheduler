<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import LoginForm from './Auth/LoginForm.vue';
import ModalView from './Modals/ModalView.vue';
import TestimonialsSlider from './Landing/TestimonialsSlider.vue';
import ArrowIcon from './icons/ArrowIcon.vue';
import { scrollBehavior } from '../utils/motion';

const showLoginForm = ref(false);

/** The FAQ section the scroll hint points to. */
const faqSection = ref<HTMLElement | null>(null);

/** The FAQ heading: focus moves to it after the hint scrolls there, so keyboard users land in the FAQ. */
const faqHeading = ref<HTMLElement | null>(null);

/** Whether the scroll hint is shown: hidden for good once the FAQ comes into view. */
const showScrollHint = ref(false);

let faqObserver: IntersectionObserver | null = null;

/**
 * Scrolls the FAQ section into view and moves focus to its heading.
 * Focus moves first: the hint removes itself once the FAQ is in view, which would otherwise drop focus to the page.
 */
function scrollToFaq() {
  faqHeading.value?.focus({ preventScroll: true });
  faqSection.value?.scrollIntoView({ behavior: scrollBehavior() });
}

onMounted(() => {
  if (!faqSection.value || typeof IntersectionObserver === 'undefined') return;

  showScrollHint.value = true;

  faqObserver = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      showScrollHint.value = false;
      faqObserver?.disconnect();
      faqObserver = null;
    }
  });

  faqObserver.observe(faqSection.value);
});

onBeforeUnmount(() => {
  faqObserver?.disconnect();
});

function handleGetStarted() {
  showLoginForm.value = true;
}

function handleCloseLoginForm() {
  showLoginForm.value = false;
}
</script>

<template>
  <div class="landing-hero">
    <h1
      class="landing-title winky-sans-900"
      tabindex="-1"
    >
      The "first" toot scheduling <br>service of all time!
    </h1>

    <button
      class="landing-button"
      @click="handleGetStarted"
    >
      Get started
    </button>
    <p class="landing-subtitle">
      An instance account is required.
    </p>
  </div>

  <div class="landing-content">
    <div class="landing-how-it-works">
      <h2 class="winky-sans-700">
        How to schedule a toot?
      </h2>
      <div class="landing-how-it-works-steps">
        <p class="step-one">
          Sign in to your instance account
        </p>
        <p class="step-two">
          Write a toot and schedule it
        </p>
        <p class="step-three">
          Relax, your toot posts automatically
        </p>
      </div>
    </div>

    <TestimonialsSlider />

    <section
      ref="faqSection"
      class="frequently-asked-questions"
    >
      <h2
        ref="faqHeading"
        class="winky-sans-700"
        tabindex="-1"
      >
        Frequently Asked Questions
      </h2>
      <div>
        <details open>
          <summary class="winky-sans-700">
            Why use this service?
          </summary>
          <p>It's easy to use and it's good looking.</p>
        </details>
        <details>
          <summary class="winky-sans-700">
            Is it free?
          </summary>
          <p>Yes, it's completely free. No hidden fees. Virtual hugs appreciated!</p>
        </details>
        <details>
          <summary class="winky-sans-700">
            Is it secure?
          </summary>
          <p>Sign-in uses OAuth with protections against forged links, your session ends after 30 minutes of inactivity and its access is then revoked, and no server stores your data: your toots stay on your instance.</p>
        </details>
        <details>
          <summary class="winky-sans-700">
            How do I schedule a toot?
          </summary>
          <p>It's easy. Just login with your instance account and start scheduling your toots today!</p>
        </details>
        <details>
          <summary class="winky-sans-700">
            First scheduling toot service, really?
          </summary>
          <p>Yep, sort of. I'm all into this "fake it till you make it" thing.</p>
        </details>
      </div>
    </section>

    <section
      class="landing-cta"
      aria-labelledby="landing-cta-title"
    >
      <div class="landing-cta-text">
        <h2
          id="landing-cta-title"
          class="winky-sans-700"
        >
          Ready to schedule your first toot?
        </h2>
        <p>It's free and takes a minute: sign in, write, pick a time. Done.</p>
      </div>
      <div class="landing-cta-action">
        <button
          type="button"
          class="landing-button"
          @click="handleGetStarted"
        >
          Get started
        </button>
        <p class="landing-subtitle">
          An instance account is required.
        </p>
      </div>
    </section>

    <Transition name="scroll-hint">
      <button
        v-if="showScrollHint"
        type="button"
        class="scroll-hint"
        aria-label="Scroll to the FAQ"
        @click="scrollToFaq"
      >
        <ArrowIcon
          direction="down"
          :size="16"
        />
        FAQ
      </button>
    </Transition>

    <ModalView
      :is-open="showLoginForm"
      labelled-by="login-title"
      @close="handleCloseLoginForm"
    >
      <LoginForm @close="handleCloseLoginForm" />
    </ModalView>
  </div>
</template>

<style>
.landing-content {
  padding: 2rem 1rem;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.landing-hero {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 25vh;
  background: radial-gradient(closest-side, antiquewhite 10%, white 100%);
  width: 100%;
  padding: 10rem 0 2rem;
}

.landing-title {
  font-size: 4rem;
  line-height: 1;
  text-align: center;
  margin-bottom: 2rem;
}

.landing-subtitle {
  font-size: 0.6rem;
  text-align: center;
  margin-top: 0.4rem;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.1em;
}

.landing-button {
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

.landing-button:hover {
  background-color: #444;
}

.landing-how-it-works {
  margin-bottom:3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 1.5rem;
  border: 2px solid #ddd;
  border-radius: 1rem;
}

.landing-how-it-works h2 {
  font-size: 2.8rem;
  margin-bottom: 1rem;
}

.step-one,
.step-two,
.step-three {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
}

.step-one:before,
.step-two:before,
.step-three:before {
  font-family: "Winky Sans", sans-serif;
  font-size: 1.1rem;
  display: inline-block;
  vertical-align: middle;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background-color: #333;
  color: #e1e1e1;
  margin-right: 0.5rem;
  text-align: center;
  line-height: 2rem;
  font-weight: 700;
}

.step-one:before {
  content: "1";
}

.step-two:before {
  content: "2";
}

.step-three:before {
  content: "3";
}

.frequently-asked-questions {
  margin-top: 2rem;
  /* Clears the fixed app header when the scroll hint brings the FAQ into view. */
  scroll-margin-top: 5rem;
  display: flex;
  flex-direction: column;
  background-color: #f0f0f0;
  padding: 1rem 1.5rem;
  border-radius: 1rem;
}

.frequently-asked-questions h2 {
  font-size: 1.8rem;
  margin-bottom: 1rem;
}

/* Focused by script only (tabindex="-1"), to move keyboard users here: not a control, so no focus ring. */
.frequently-asked-questions h2:focus {
  outline: none;
}

.frequently-asked-questions details {
  background-color: #fff;
  padding: 1rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1.2rem;
  margin-bottom: 1rem;
}

.frequently-asked-questions details summary {
  cursor: pointer;
  color: #333;
  margin-bottom: 0.5rem;
}

@media (max-width: 768px) {
  .landing-title {
    font-size: 2.5rem;
  }

  .landing-how-it-works h2 {
    font-size: 2rem;
  }
}
</style>

<style scoped>
.landing-cta {
  margin-top: 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 2rem 1.5rem;
  border: 2px solid #ddd;
  border-radius: 1rem;
}

.landing-cta-text h2 {
  font-size: 1.8rem;
  line-height: 1.2;
  margin-bottom: 0.5rem;
}

.landing-cta-text p {
  font-size: 1.1rem;
}

.landing-cta-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.landing-cta-action .landing-button {
  margin-top: 0;
}

.landing-cta-action .landing-button:focus-visible {
  outline: 2px solid #646cff;
  outline-offset: 2px;
}

.scroll-hint {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.5rem 0.5rem 1rem;
  border: none;
  border-radius: 3rem;
  background-color: #333;
  color: #fff;
  font-size: 1rem;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.scroll-hint:hover {
  background-color: #222;
}

.scroll-hint:focus-visible {
  outline: 2px solid #646cff;
  outline-offset: 2px;
}

.scroll-hint-enter-active,
.scroll-hint-leave-active {
  transition: opacity 0.3s ease;
}

.scroll-hint-enter-from,
.scroll-hint-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .landing-cta {
    flex-direction: column;
    text-align: center;
    gap: 1.5rem;
  }

  .landing-cta-action {
    width: 100%;
  }

  .landing-cta-action .landing-button {
    width: 100%;
  }

  .scroll-hint {
    bottom: 1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scroll-hint-enter-active,
  .scroll-hint-leave-active {
    transition: none;
  }
}
</style>
