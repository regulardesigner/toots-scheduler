<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import LoginForm from './Auth/LoginForm.vue';
import ModalView from './Modals/ModalView.vue';
import ArrowIcon from './icons/ArrowIcon.vue';
import { scrollBehavior } from '../utils/motion';

const showLoginForm = ref(false);

/** The FAQ section the scroll hint points to. */
const faqSection = ref<HTMLElement | null>(null);

/** Whether the scroll hint is shown: hidden for good once the FAQ comes into view. */
const showScrollHint = ref(false);

let faqObserver: IntersectionObserver | null = null;

/**
 * Scrolls the FAQ section into view.
 */
function scrollToFaq() {
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

/** The horizontal testimonials slider the arrow buttons move. */
const testimonialsTrack = ref<HTMLElement | null>(null);

/** Whether the slider can still move backwards / forwards: each arrow is disabled at its end. */
const canScrollPrev = ref(false);
const canScrollNext = ref(false);

let testimonialsResizeObserver: ResizeObserver | null = null;

/**
 * Enables each arrow only when the slider has room to move that way (1px slack for rounding).
 */
function updateTestimonialsArrows() {
  const track = testimonialsTrack.value;
  if (!track) return;
  canScrollPrev.value = track.scrollLeft > 1;
  canScrollNext.value = track.scrollLeft + track.clientWidth < track.scrollWidth - 1;
}

onMounted(() => {
  updateTestimonialsArrows();
  if (!testimonialsTrack.value || typeof ResizeObserver === 'undefined') return;
  testimonialsResizeObserver = new ResizeObserver(updateTestimonialsArrows);
  testimonialsResizeObserver.observe(testimonialsTrack.value);
});

onBeforeUnmount(() => {
  testimonialsResizeObserver?.disconnect();
});

/**
 * Slides the testimonials by about one card, backwards (-1) or forwards (1).
 */
function scrollTestimonials(direction: -1 | 1) {
  const track = testimonialsTrack.value;
  if (!track) return;
  const slide = track.querySelector<HTMLElement>('.testimonial-slide');
  const step = slide ? slide.offsetWidth : track.clientWidth * 0.8;
  track.scrollBy({ left: direction * step, behavior: scrollBehavior() });
}

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

    <section
      class="landing-testimonials"
      aria-labelledby="landing-testimonials-title"
    >
      <h2
        id="landing-testimonials-title"
        class="winky-sans-700"
      >
        What our (totally real) users say
      </h2>
      <p class="landing-testimonials-note">
        Well maybe not, but real reviews welcome!
      </p>
      <div class="testimonials-viewport">
        <button
          type="button"
          class="testimonials-arrow testimonials-arrow-prev"
          aria-label="Previous testimonial"
          :disabled="!canScrollPrev"
          @click="scrollTestimonials(-1)"
        >
          <ArrowIcon direction="left" />
        </button>
        <div
          ref="testimonialsTrack"
          class="testimonials-track"
          role="region"
          aria-label="Testimonials"
          tabindex="0"
          @scroll.passive="updateTestimonialsArrows"
        >
          <ul class="testimonials-list">
            <li class="testimonial-slide">
              <figure class="testimonial">
                <blockquote>
                  <p>“I schedule my toots over breakfast, then spend the rest of the day on neighbourhood watch from the window. Time well saved.”</p>
                </blockquote>
                <figcaption>Tod, cat and neighbourhood watch volunteer</figcaption>
              </figure>
            </li>
            <li class="testimonial-slide">
              <figure class="testimonial">
                <blockquote>
                  <p>“I read toots in my Mastodon app and write them here. No timeline, no notifications, just me and my words.”</p>
                </blockquote>
                <figcaption>A writer who finally finishes a thought</figcaption>
              </figure>
            </li>
            <li class="testimonial-slide">
              <figure class="testimonial">
                <blockquote>
                  <p>“I scheduled our anniversary toot weeks in advance. It went out on time and saved my marriage. Someone should hire whoever built this.”</p>
                </blockquote>
                <figcaption>Someone still happily married</figcaption>
              </figure>
            </li>
            <li class="testimonial-slide">
              <figure class="testimonial testimonial-yours">
                <blockquote>
                  <p>“Your review here.”</p>
                </blockquote>
                <figcaption>
                  Tried it? Be the first to review it: toot
                  <a
                    href="https://mastodon.social/@damsdev"
                    target="_blank"
                    rel="noopener noreferrer"
                  >@damsdev@mastodon.social</a>
                  and your words could land right here.
                </figcaption>
              </figure>
            </li>
          </ul>
        </div>
        <button
          type="button"
          class="testimonials-arrow testimonials-arrow-next"
          aria-label="Next testimonial"
          :disabled="!canScrollNext"
          @click="scrollTestimonials(1)"
        >
          <ArrowIcon direction="right" />
        </button>
      </div>
    </section>

    <section
      class="frequently-asked-questions"
    >
      <h2 class="winky-sans-700">
        Frequently Asked Questions
      </h2>
      <div ref="faqSection">
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
.landing-testimonials {
  margin-bottom: 3rem;
}

.landing-testimonials h2 {
  font-size: 1.8rem;
  text-align: center;
}

.landing-testimonials-note {
  text-align: center;
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

/* White fades over the slider's left and right edges, so cards fade out instead of being cut; the arrows sit on top. */
.testimonials-viewport {
  position: relative;
}

.testimonials-viewport::before,
.testimonials-viewport::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  width: 6rem;
  pointer-events: none;
}

.testimonials-viewport::before {
  left: 0;
  background: linear-gradient(to right, #fff, rgba(255, 255, 255, 0));
}

.testimonials-viewport::after {
  right: 0;
  background: linear-gradient(to left, #fff, rgba(255, 255, 255, 0));
}

.testimonials-track {
  overflow-x: auto;
  /* Not "auto": swinging cards poke out vertically, which would make the track catch vertical scroll from the page. */
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  border-radius: 1rem;
}

.testimonials-track::-webkit-scrollbar {
  display: none;
}

.testimonials-track:focus-visible {
  outline: 2px solid #646cff;
  outline-offset: 2px;
}

.testimonials-list {
  --card-width: min(18rem, 75vw);
  list-style: none;
  margin: 0;
  display: flex;
  gap: 1.5rem;
  width: max-content;
  /* Percent padding resolves against the track width: room to center the first and last cards, and for tilted corners. */
  padding: 2rem calc((100% - var(--card-width)) / 2);
}

.testimonial-slide {
  flex: 0 0 var(--card-width);
  scroll-snap-align: center;
  display: flex;
}

.testimonial {
  --tilt: -3deg;
  margin: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem;
  /* antiquewhite, mixed halfway with white. */
  background-color: #fcf5eb;
  border: 2px solid #fcf5eb;
  border-radius: 1rem;
  transform: rotate(var(--tilt));
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.testimonial-slide:nth-child(2) .testimonial {
  --tilt: 2.5deg;
}

.testimonial-slide:nth-child(3) .testimonial {
  --tilt: -1.5deg;
}

.testimonial-slide:nth-child(4) .testimonial {
  --tilt: 3.5deg;
}

.testimonial:hover {
  transform: rotate(0) scale(1.03);
}

.testimonial blockquote {
  margin: 0;
  font-size: 1.1rem;
}

.testimonial figcaption {
  font-size: 0.9rem;
  color: #666;
}

/* Left white with a dashed outline: an empty slot waiting for a real review. */
.testimonial-yours {
  background-color: #fff;
  border-color: #ddd;
  border-style: dashed;
}

/* Highlighter-pen look: the lower part of the line is marked, the whole line on hover. */
.testimonial-yours a {
  color: #000;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.15em;
  background-image: linear-gradient(transparent 45%, antiquewhite 45%);
  background-size: 100% 100%;
  background-repeat: no-repeat;
  padding: 0 0.15em;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.testimonial-yours a:hover {
  background-image: linear-gradient(antiquewhite, antiquewhite);
}

.testimonial-yours a:focus-visible {
  outline: 2px solid #646cff;
  outline-offset: 2px;
}

.testimonials-arrow {
  position: absolute;
  top: 50%;
  z-index: 2;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border: none;
  border-radius: 50%;
  background-color: #333;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.testimonials-arrow-prev {
  left: 0.5rem;
}

.testimonials-arrow-next {
  right: 0.5rem;
}

.testimonials-arrow:hover:not(:disabled) {
  background-color: #222;
}

/* Nothing more to see that way: greyed out, and the cards stay visible behind it. */
.testimonials-arrow:disabled {
  background-color: #ddd;
  color: #999;
  cursor: not-allowed;
}

.testimonials-arrow:focus-visible {
  outline: 2px solid #646cff;
  outline-offset: 2px;
}

/* Cards swing in, settle at the center, then swing out, following the slider's scroll. */
@keyframes testimonial-swing {
  0% {
    transform: translateY(1.5rem) rotate(12deg) scale(0.88);
  }
  50% {
    transform: none;
  }
  100% {
    transform: translateY(1.5rem) rotate(-12deg) scale(0.88);
  }
}

@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .testimonial-slide {
      animation: testimonial-swing linear both;
      animation-timeline: view(inline);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .testimonial {
    transition: none;
  }
}

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
  .testimonials-viewport::before,
  .testimonials-viewport::after {
    width: 3rem;
  }

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
