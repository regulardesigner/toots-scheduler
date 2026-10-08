import type { App } from 'vue';
import { useNotify } from './useNotify';
import { logError } from '../utils/logError';

/** What the user is told when something fails that no part of the app handled. */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again, or reload the page if it keeps happening.';

/** A burst of errors (a render loop, a failing timer) shows one toast, not dozens. */
const TOAST_INTERVAL_MS = 5000;

/**
 * Catches what nothing else handled, so a failure never leaves a blank page in silence:
 * errors thrown by components, hooks, watchers and event handlers (`app.config.errorHandler`),
 * and promises rejected without a catch (`unhandledrejection`). Each shows a generic toast
 * (at most one every 5 seconds) and is logged in DEV only, through logError.
 * The browser's own "Uncaught (in promise)" log is suppressed: the reason may be an AxiosError,
 * whose request headers hold the bearer token.
 * @param {App} app - The Vue application, before it is mounted.
 * @param {Window} [target] - Where unhandled rejections are listened for.
 * @returns {Object} `uninstall`, which stops listening for rejections.
 */
export function useGlobalErrorHandler(app: App, target: Window = window) {
  const notify = useNotify();
  let lastToastAt = -Infinity;

  function report(context: string, error: unknown): void {
    logError(context, error);
    const now = Date.now();
    if (now - lastToastAt < TOAST_INTERVAL_MS) return;
    lastToastAt = now;
    notify.error(GENERIC_ERROR_MESSAGE);
  }

  app.config.errorHandler = (error, _instance, info) => report(`Unhandled error (${info})`, error);

  function onUnhandledRejection(event: PromiseRejectionEvent): void {
    event.preventDefault();
    report('Unhandled promise rejection', event.reason);
  }
  target.addEventListener('unhandledrejection', onUnhandledRejection);

  return {
    uninstall: () => target.removeEventListener('unhandledrejection', onUnhandledRejection),
  };
}
