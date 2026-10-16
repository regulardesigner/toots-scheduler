/**
 * Whether the user asked their system to reduce motion.
 * @returns {boolean} True when `prefers-reduced-motion: reduce` matches; false where matchMedia is unavailable.
 */
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The scroll behavior to pass to scrollIntoView / scrollBy: instant when the user asked to reduce motion.
 * @returns {ScrollBehavior} 'auto' under reduced motion, 'smooth' otherwise.
 */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
