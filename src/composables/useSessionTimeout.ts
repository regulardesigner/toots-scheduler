import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '../stores/auth';

// For testing: 30 seconds total, with warning at 10 seconds before expiry
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE = 5 * 60 * 1000;    // 5 minutes warning

// Production values (commented for reference):
// const SESSION_DURATION = 60 * 60 * 1000; // 1 hour
// const WARNING_BEFORE = 5 * 60 * 1000;    // 5 minutes warning

export function useSessionTimeout() {
  const router = useRouter();
  const toast = useToast();
  const auth = useAuthStore();
  
  const sessionTimer = ref<number | null>(null);
  const warningTimer = ref<number | null>(null);
  const warningToast = ref<any>(null);

  function clearTimers() {
    if (sessionTimer.value) {
      window.clearTimeout(sessionTimer.value);
      sessionTimer.value = null;
    }
    if (warningTimer.value) {
      window.clearTimeout(warningTimer.value);
      warningTimer.value = null;
    }
    if (warningToast.value) {
      toast.dismiss(warningToast.value);
      warningToast.value = null;
    }
  }

  function startSessionTimer() {
    clearTimers();

    // Set warning timer
    warningTimer.value = window.setTimeout(() => {
      warningToast.value = toast.warning(
        "Your session will expire in 5 minutes. Click here to extend.",
        {
          timeout: WARNING_BEFORE,
          closeOnClick: false,
          onClick: extendSession
        }
      );
    }, SESSION_DURATION - WARNING_BEFORE);

    // Set logout timer
    sessionTimer.value = window.setTimeout(async () => {
      await auth.logout();
      toast.info("You've been logged out due to inactivity");
      router.push('/');
    }, SESSION_DURATION);
  }

  function extendSession() {
    toast.success("Session extended for 30 minutes");
    startSessionTimer();
  }

  // Reset timer on user activity
  function handleUserActivity() {
    if (auth.accessToken) {
      startSessionTimer();
    }
  }

  onMounted(() => {
    if (auth.accessToken) {
      startSessionTimer();
    }

    // Add activity listeners
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keypress', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
  });

  onUnmounted(() => {
    clearTimers();
    window.removeEventListener('mousemove', handleUserActivity);
    window.removeEventListener('keypress', handleUserActivity);
    window.removeEventListener('click', handleUserActivity);
  });

  return {
    extendSession
  };
} 