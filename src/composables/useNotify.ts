import { useToast } from 'vue-toastification';
import { useAnnouncer } from './useAnnouncer';

type ToastInterface = ReturnType<typeof useToast>;
/** The options every toast type accepts (each method's own `type` is left out). */
type ToastOptions = Omit<NonNullable<Parameters<ToastInterface['success']>[1]>, 'type'>;
type ToastId = ReturnType<ToastInterface['success']>;

/**
 * Notifications: the visual toast, plus the same text spoken by the app's live regions.
 * The toasts themselves are not live regions (see `accessibility.toastRole` in main.ts),
 * so each message is spoken once. Errors and warnings interrupt; success and info wait.
 * @returns {Object} `success`, `info`, `warning`, `error` (each returns the toast id) and `dismiss`.
 */
export function useNotify() {
  const toast = useToast();
  const { announce } = useAnnouncer();

  function notify(type: 'success' | 'info' | 'warning' | 'error', message: string, options?: ToastOptions): ToastId {
    announce(message, { assertive: type === 'warning' || type === 'error' });
    return toast[type](message, options);
  }

  return {
    /** Shows a success toast and announces it politely. */
    success: (message: string, options?: ToastOptions) => notify('success', message, options),
    /** Shows an info toast and announces it politely. */
    info: (message: string, options?: ToastOptions) => notify('info', message, options),
    /** Shows a warning toast and announces it assertively. */
    warning: (message: string, options?: ToastOptions) => notify('warning', message, options),
    /** Shows an error toast and announces it assertively. */
    error: (message: string, options?: ToastOptions) => notify('error', message, options),
    /** Removes a toast (its announcement, already spoken, is left as is). */
    dismiss: (id: ToastId) => toast.dismiss(id),
  };
}
