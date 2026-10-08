import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { createApp, defineComponent, nextTick, type App } from 'vue';

const notify = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('./useNotify', () => ({ useNotify: () => notify }));

import { GENERIC_ERROR_MESSAGE, useGlobalErrorHandler } from './useGlobalErrorHandler';

/** A component whose setup throws, as a rendering bug would. */
const Broken = defineComponent({
  setup() {
    throw new Error('Boom');
  },
  render: () => null,
});

/** An unhandled rejection as the browser dispatches it (happy-dom has no PromiseRejectionEvent). */
function rejection(reason: unknown): Event {
  const event = new Event('unhandledrejection', { cancelable: true });
  Object.defineProperty(event, 'reason', { value: reason });
  return event;
}

let app: App | null = null;
let uninstall: (() => void) | null = null;
/** console.error, silenced: what the handler logs is read from here. */
let log: MockInstance<typeof console.error>;

function install(): App {
  app = createApp(Broken);
  uninstall = useGlobalErrorHandler(app).uninstall;
  return app;
}

describe('useGlobalErrorHandler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {}); // Vue's own dev warnings
  });

  afterEach(() => {
    app?.unmount();
    app = null;
    uninstall?.();
    uninstall = null;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('shows the generic toast when a component throws, and logs a summary in DEV', async () => {
    install().mount(document.createElement('div'));

    await nextTick();

    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledWith(GENERIC_ERROR_MESSAGE);
    expect(log).toHaveBeenCalledWith('Unhandled error (setup function): Error: Boom', expect.stringContaining('Boom'));
  });

  it('shows the generic toast for a promise rejected without a catch, and keeps the browser from logging it', async () => {
    install();
    const event = rejection(new Error('Lost request'));

    window.dispatchEvent(event);
    await nextTick();

    expect(notify.error).toHaveBeenCalledWith(GENERIC_ERROR_MESSAGE);
    expect(event.defaultPrevented).toBe(true);
    expect(log).toHaveBeenCalledWith('Unhandled promise rejection: Error: Lost request', expect.stringContaining('Lost request'));
  });

  it('never logs what was rejected when it is not an Error (a raw response, say)', () => {
    install();

    window.dispatchEvent(rejection({ config: { headers: { Authorization: 'Bearer secret-token' } } }));

    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token');
  });

  it('shows one toast for a burst of errors (all logged), then again after a pause', async () => {
    vi.useFakeTimers();
    install();

    window.dispatchEvent(rejection(new Error('1')));
    window.dispatchEvent(rejection(new Error('2')));
    await nextTick();
    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(5000);
    window.dispatchEvent(rejection(new Error('3')));
    await nextTick();
    expect(notify.error).toHaveBeenCalledTimes(2);
  });

  it('logs nothing in production, and still tells the user', async () => {
    vi.stubEnv('DEV', false);
    install();

    window.dispatchEvent(rejection(new Error('Lost request')));
    await nextTick();

    expect(notify.error).toHaveBeenCalledWith(GENERIC_ERROR_MESSAGE);
    expect(log).not.toHaveBeenCalled();
  });

  it('shows the generic toast for an error thrown in a timer callback, without preventing the browser log', async () => {
    install();
    const event = new ErrorEvent('error', { error: new Error('Timer'), cancelable: true });

    window.dispatchEvent(event);
    await nextTick();

    expect(notify.error).toHaveBeenCalledWith(GENERIC_ERROR_MESSAGE);
    expect(event.defaultPrevented).toBe(false);
    expect(log).toHaveBeenCalledWith('Unhandled error event: Error: Timer', expect.stringContaining('Timer'));
  });

  it('ignores error events without an error object (cross-origin "Script error.", ResizeObserver loop)', async () => {
    install();

    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.', error: null }));
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications' }));
    await nextTick();

    expect(notify.error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('stops listening once uninstalled', async () => {
    install();
    uninstall?.();

    window.dispatchEvent(rejection(new Error('Late')));
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('Late') }));
    await nextTick();

    expect(notify.error).not.toHaveBeenCalled();
  });
});
