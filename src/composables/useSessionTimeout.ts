import { onMounted, onUnmounted, watch } from 'vue';
import { useToast } from 'vue-toastification';
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
  const toast = useToast();
  const auth = useAuthStore();

  let warningTimer: number | undefined;
  let expiryTimer: number | undefined;
  let warningToastId: ReturnType<typeof toast.warning> | null = null;

  function clearTimers(): void {
    window.clearTimeout(warningTimer);
    window.clearTimeout(expiryTimer);
    if (warningToastId !== null) {
      toast.dismiss(warningToastId);
      warningToastId = null;
    }
  }

  async function expire(): Promise<void> {
    clearTimers();
    // Re-checks storage: activity in another tab may not have reached this tab yet.
    await auth.expireIfIdle();
  }

  function extendSession(): void {
    auth.recordActivity();
    toast.success('Session extended for 30 minutes');
  }

  function showWarning(): void {
    warningToastId = toast.warning('Your session is about to expire. Click here to stay signed in.', {
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
    auth.recordActivity();
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
