import { onMounted, onUnmounted, watch } from 'vue';
import { useNotify } from './useNotify';
import { useAuthStore } from '../stores/auth';
import { SESSION_DURATION_MS, SESSION_WARNING_MS } from '../config/constants';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'wheel'] as const;
/** Capture phase: `scroll` does not bubble, so scrolling inside an element would be missed otherwise. */
const LISTENER_OPTIONS = { capture: true, passive: true } as const;

/**
 * Ends the session after SESSION_DURATION_MS without activity, with a warning
 * SESSION_WARNING_MS before. Timers are computed from the persisted last activity,
 * so activity in another tab counts too, and a closed tab is handled at the next start.
 */
export function useSessionTimeout() {
  const notify = useNotify();
  const auth = useAuthStore();

  let warningTimer: number | undefined;
  let expiryTimer: number | undefined;
  let warningToastId: ReturnType<typeof notify.warning> | null = null;

  function clearTimers(): void {
    window.clearTimeout(warningTimer);
    window.clearTimeout(expiryTimer);
    if (warningToastId !== null) {
      notify.dismiss(warningToastId);
      warningToastId = null;
    }
  }

  async function expire(): Promise<void> {
    clearTimers();
    // Re-checks storage: activity in another tab may not have reached this tab yet.
    await auth.expireIfIdle();
  }

  /**
   * Records activity; while the warning is shown, also dismisses it and confirms the extension.
   * A click on the warning arrives twice (its pointerdown, then onClick): only the first one confirms.
   */
  function extendSession(): void {
    const now = Date.now();
    const warning = warningToastId;
    auth.recordActivity(now);
    // Not extended if the session had already expired (a late timer) or another tab replaced it.
    if (warning === null || auth.lastActivityAt !== now) return;
    notify.dismiss(warning);
    warningToastId = null;
    notify.success('Session extended for 30 minutes');
  }

  function showWarning(): void {
    // Any key or click counts (the toast itself cannot be focused): WCAG 2.2.1 and 2.1.1.
    warningToastId = notify.warning('Your session is about to expire. Press any key or click anywhere to stay signed in.', {
      timeout: SESSION_WARNING_MS,
      closeOnClick: false,
      onClick: extendSession,
    });
  }

  function schedule(): void {
    clearTimers();
    if (!auth.accessToken || auth.lastActivityAt === null) return;

    const remaining = auth.lastActivityAt + SESSION_DURATION_MS - Date.now();
    if (remaining <= 0) {
      void expire();
      return;
    }
    warningTimer = window.setTimeout(showWarning, Math.max(0, remaining - SESSION_WARNING_MS));
    expiryTimer = window.setTimeout(() => void expire(), remaining);
  }

  function handleActivity(): void {
    // The store only writes (and so only reschedules) every ACTIVITY_WRITE_INTERVAL_MS.
    if (warningToastId !== null) extendSession();
    else auth.recordActivity();
  }

  function handleVisibilityChange(): void {
    // Background tabs throttle timers: re-check as soon as the tab is visible again.
    if (document.visibilityState === 'visible') schedule();
  }

  watch([() => auth.accessToken, () => auth.lastActivityAt], schedule);

  onMounted(() => {
    schedule();
    ACTIVITY_EVENTS.forEach(name => window.addEventListener(name, handleActivity, LISTENER_OPTIONS));
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onUnmounted(() => {
    clearTimers();
    ACTIVITY_EVENTS.forEach(name => window.removeEventListener(name, handleActivity, LISTENER_OPTIONS));
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  return {
    extendSession,
  };
}
