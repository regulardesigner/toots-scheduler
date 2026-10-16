<script setup lang="ts">
/** Slack, in pixels, for fractional scroll positions when checking whether the slider reached an end. */
const SCROLL_EDGE_SLACK_PX = 1;

import { ref, onMounted, onBeforeUnmount } from 'vue';
import ArrowIcon from '../icons/ArrowIcon.vue';
import { scrollBehavior } from '../../utils/motion';

/** The horizontal scroller the arrow buttons move. */
const track = ref<HTMLElement | null>(null);

/** The list of cards inside the track: its first card gives the distance to slide. */
const list = ref<HTMLElement | null>(null);

/** Whether the slider can still move backwards: "Previous" is marked disabled at the start. */
const canScrollPrev = ref(false);

/** Whether the slider can still move forwards: "Next" is marked disabled at the end. */
const canScrollNext = ref(false);

let resizeObserver: ResizeObserver | null = null;

/**
 * Enables each arrow only when the slider has room to move that way.
 */
function updateArrows() {
  if (!track.value) return;
  const { scrollLeft, clientWidth, scrollWidth } = track.value;
  canScrollPrev.value = scrollLeft > SCROLL_EDGE_SLACK_PX;
  canScrollNext.value = scrollLeft + clientWidth < scrollWidth - SCROLL_EDGE_SLACK_PX;
}

/**
 * Slides by about one card, backwards (-1) or forwards (1).
 * Does nothing at that end: the arrows stay focusable there (aria-disabled), so keyboard focus is never lost.
 */
function slide(direction: -1 | 1) {
  if (!track.value || !list.value) return;
  if (direction === -1 ? !canScrollPrev.value : !canScrollNext.value) return;
  const card = list.value.firstElementChild as HTMLElement | null;
  const step = card?.offsetWidth ?? 0;
  track.value.scrollBy({ left: direction * step, behavior: scrollBehavior() });
}

onMounted(() => {
  updateArrows();
  if (!track.value || typeof ResizeObserver === 'undefined') return;
  resizeObserver = new ResizeObserver(updateArrows);
  resizeObserver.observe(track.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <section
    class="testimonials"
    aria-labelledby="testimonials-title"
  >
    <h2
      id="testimonials-title"
      class="winky-sans-700"
    >
      What our (totally real) users say
    </h2>
    <p class="testimonials-note">
      Well maybe not, but real reviews welcome!
    </p>
    <div class="testimonials-viewport">
      <button
        type="button"
        class="testimonials-arrow testimonials-arrow-prev"
        aria-label="Previous testimonial"
        :aria-disabled="!canScrollPrev"
        @click="slide(-1)"
      >
        <ArrowIcon direction="left" />
      </button>
      <div
        ref="track"
        class="testimonials-track"
        role="region"
        aria-label="Testimonials"
        tabindex="0"
        @scroll.passive="updateArrows"
      >
        <ul
          ref="list"
          class="testimonials-list"
        >
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
        :aria-disabled="!canScrollNext"
        @click="slide(1)"
      >
        <ArrowIcon direction="right" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.testimonials {
  margin-bottom: 3rem;
}

.testimonials h2 {
  font-size: 1.8rem;
  text-align: center;
}

.testimonials-note {
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

/* Mouse only: on touch screens a tap leaves :hover stuck while swiping on. */
@media (hover: hover) and (pointer: fine) {
  .testimonial:hover {
    transform: rotate(0) scale(1.03);
  }
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

.testimonials-arrow:hover:not([aria-disabled="true"]) {
  background-color: #222;
}

/* Nothing more to see that way: greyed out, but still focusable so keyboard focus stays put. */
.testimonials-arrow[aria-disabled="true"] {
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

@media (max-width: 768px) {
  .testimonials-viewport::before,
  .testimonials-viewport::after {
    width: 3rem;
  }
}

</style>
