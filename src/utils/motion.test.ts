import { describe, it, expect, vi, afterEach } from 'vitest';
import { prefersReducedMotion, scrollBehavior } from './motion';

/** Stubs matchMedia so that only the reduced-motion query matches, or nothing does. */
function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query === '(prefers-reduced-motion: reduce)' }));
}

describe('motion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scrolls smoothly when the user has no motion preference', () => {
    stubReducedMotion(false);

    expect(prefersReducedMotion()).toBe(false);
    expect(scrollBehavior()).toBe('smooth');
  });

  it('scrolls instantly when the user asked to reduce motion', () => {
    stubReducedMotion(true);

    expect(prefersReducedMotion()).toBe(true);
    expect(scrollBehavior()).toBe('auto');
  });

  it('assumes no preference where matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(prefersReducedMotion()).toBe(false);
  });
});
