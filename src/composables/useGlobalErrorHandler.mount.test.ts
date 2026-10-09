import { describe, it, expect, vi, afterEach } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import Toast from 'vue-toastification';
import { GENERIC_ERROR_MESSAGE, useGlobalErrorHandler } from './useGlobalErrorHandler';

/** Throws in setup, during the very first render (mounted as the root, under app.use(Toast)). */
const Broken = defineComponent({
  setup() {
    throw new Error('Boom');
  },
  render: () => h('div'),
});

describe('useGlobalErrorHandler, with the real toast plugin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('displays the toast for an error thrown during the first mount', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = createApp(Broken);
    app.use(Toast);
    const { uninstall } = useGlobalErrorHandler(app);
    const host = document.createElement('div');
    document.body.appendChild(host);

    app.mount(host);
    await nextTick();
    await nextTick();

    const toast = document.querySelector('.Vue-Toastification__toast');
    expect(toast?.textContent).toContain(GENERIC_ERROR_MESSAGE);

    app.unmount();
    uninstall();
  });
});
