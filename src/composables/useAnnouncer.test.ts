import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ANNOUNCE_DELAY_MS, CLEAR_AFTER_MS, READY_DELAY_MS, resetAnnouncer, useAnnouncer } from './useAnnouncer';

describe('useAnnouncer', () => {
  const { announce, markReady, politeMessage, assertiveMessage } = useAnnouncer();

  /** The regions have been in the page long enough. */
  function ready(): void {
    markReady();
    vi.advanceTimersByTime(READY_DELAY_MS);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    resetAnnouncer();
  });

  afterEach(() => {
    resetAnnouncer();
    vi.useRealTimers();
  });

  it('empties the polite region at once and sets the text after the delay', () => {
    ready();
    announce('First');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(politeMessage.value).toBe('First');

    announce('Second');
    expect(politeMessage.value).toBe('');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS - 1);
    expect(politeMessage.value).toBe('');
    vi.advanceTimersByTime(1);
    expect(politeMessage.value).toBe('Second');
  });

  it('re-announces an identical message: the region is emptied, then filled again', () => {
    ready();
    announce('Same message');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(politeMessage.value).toBe('Same message');

    announce('Same message');
    expect(politeMessage.value).toBe('');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(politeMessage.value).toBe('Same message');
  });

  it('uses the assertive region only when asked to, leaving the other one alone', () => {
    ready();
    announce('Polite one');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);

    announce('Something failed', { assertive: true });
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);

    expect(assertiveMessage.value).toBe('Something failed');
    expect(politeMessage.value).toBe('Polite one');
  });

  it('keeps every distinct message announced within the delay, once each', () => {
    ready();
    announce('One');
    announce('Two');
    announce('One');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);

    expect(politeMessage.value).toBe('One Two');
  });

  it('ignores an empty message', () => {
    ready();
    announce('Kept');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    announce('   ');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);

    expect(politeMessage.value).toBe('Kept');
  });

  it('clears the text CLEAR_AFTER_MS after writing it', () => {
    ready();
    announce('Short-lived', { assertive: true });
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);

    vi.advanceTimersByTime(CLEAR_AFTER_MS - 1);
    expect(assertiveMessage.value).toBe('Short-lived');
    vi.advanceTimersByTime(1);
    expect(assertiveMessage.value).toBe('');
  });

  it('does not clear a newer message on the previous one\'s schedule', () => {
    ready();
    announce('Older');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    vi.advanceTimersByTime(5000);

    announce('Newer');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    vi.advanceTimersByTime(CLEAR_AFTER_MS - 5000);
    expect(politeMessage.value).toBe('Newer');

    vi.advanceTimersByTime(5000);
    expect(politeMessage.value).toBe('');
  });

  it('waits until the regions are mounted, then READY_DELAY_MS, before the first message', () => {
    announce('Session ended', { assertive: true });
    vi.advanceTimersByTime(2000);
    expect(assertiveMessage.value).toBe('');

    markReady();
    vi.advanceTimersByTime(READY_DELAY_MS - 1);
    expect(assertiveMessage.value).toBe('');
    vi.advanceTimersByTime(1);
    expect(assertiveMessage.value).toBe('Session ended');
  });

  it('a message right after mounting also waits READY_DELAY_MS, later ones only ANNOUNCE_DELAY_MS', () => {
    markReady();
    announce('Early');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(politeMessage.value).toBe('');
    vi.advanceTimersByTime(READY_DELAY_MS - ANNOUNCE_DELAY_MS);
    expect(politeMessage.value).toBe('Early');

    announce('Later');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(politeMessage.value).toBe('Later');
  });
});
