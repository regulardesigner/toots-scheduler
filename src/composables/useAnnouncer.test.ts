import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ANNOUNCE_DELAY_MS, useAnnouncer } from './useAnnouncer';

describe('useAnnouncer', () => {
  const { announce, politeMessage, assertiveMessage } = useAnnouncer();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('empties the polite region at once and sets the text after the delay', () => {
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
    announce('Same message');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(politeMessage.value).toBe('Same message');

    announce('Same message');
    expect(politeMessage.value).toBe('');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(politeMessage.value).toBe('Same message');
  });

  it('uses the assertive region only when asked to, leaving the other one alone', () => {
    announce('Polite one');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);

    announce('Something failed', { assertive: true });
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);

    expect(assertiveMessage.value).toBe('Something failed');
    expect(politeMessage.value).toBe('Polite one');
  });

  it('keeps every distinct message announced within the delay, once each', () => {
    announce('One');
    announce('Two');
    announce('One');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);

    expect(politeMessage.value).toBe('One Two');
  });

  it('ignores an empty message', () => {
    announce('Kept');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    announce('   ');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);

    expect(politeMessage.value).toBe('Kept');
  });
});
