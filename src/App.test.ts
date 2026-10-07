import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { defineComponent, h } from 'vue';
import { useAuthStore } from './stores/auth';
import { settleFocus } from './test-utils/settle';
import { ANNOUNCE_DELAY_MS } from './composables/useAnnouncer';

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() }));
vi.mock('vue-toastification', () => ({ useToast: () => toast }));

const api = vi.hoisted(() => ({ sendThanks: vi.fn(), getInstanceConfiguration: vi.fn(async () => ({})) }));
vi.mock('./composables/useMastodonApi', () => ({ useMastodonApi: () => api }));

import App from './App.vue';

/** Lets the announcer fill its region. */
const waitAnnouncement = () => new Promise(resolve => setTimeout(resolve, ANNOUNCE_DELAY_MS + 20));
const politeRegion = () => document.querySelector('[role="status"][aria-live="polite"]');
const assertiveRegion = () => document.querySelector('[role="alert"][aria-live="assertive"]');

/** Two pages, each with its own focusable main heading, as in the app. */
const headingPage = (text: string) => defineComponent({ render: () => h('h1', { tabindex: -1 }, text) });
const Page = headingPage('A page');
const Protected = headingPage('A protected page');

let wrapper: VueWrapper | undefined;

async function mountApp(signedIn = false, path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Page },
      { path: '/composer', name: 'composer', component: Protected, meta: { requiresAuth: true } },
    ],
  });
  const pinia = createPinia();
  setActivePinia(pinia);
  if (signedIn) useAuthStore().accessToken = 'token';
  await router.push(path);
  await router.isReady();
  wrapper = mount(App, { attachTo: document.body, global: { plugins: [pinia, router] } });
  await flushPromises();
  return wrapper;
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    document.body.innerHTML = '';
  });

  it('renders the page inside the only <main>, and leaves the <h1> to the page', async () => {
    const wrapper = await mountApp();

    expect(wrapper.findAll('main')).toHaveLength(1);
    expect(wrapper.find('main h1').text()).toBe('A page');
    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('.header-title').element.tagName).toBe('P');
  });

  it("keeps focus in the account navigation after What's New closes and its button disappears", async () => {
    const wrapper = await mountApp(true);
    const whatsNew = wrapper.find('.desktop-nav .whats-new-button');
    expect(whatsNew.exists()).toBe(true);
    (whatsNew.element as HTMLButtonElement).focus();

    await whatsNew.trigger('click');
    await settleFocus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();

    expect(wrapper.find('.desktop-nav .whats-new-button').exists()).toBe(false);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(wrapper.find('.desktop-nav .thanks-button').element);
  });

  it('names the account navigation, and puts focus on the page heading after logout', async () => {
    const wrapper = await mountApp(true);
    expect(wrapper.findAll('nav[aria-label="Account"]')).toHaveLength(2);

    await wrapper.find('.desktop-nav .logout-button').trigger('click');
    await flushPromises();

    expect(document.activeElement).toBe(wrapper.find('main h1').element);
  });

  it('logging out from a protected page lands focus on the home heading, not on the page being left', async () => {
    const wrapper = await mountApp(true, '/composer');
    expect(wrapper.find('main h1').text()).toBe('A protected page');

    await wrapper.find('.desktop-nav .logout-button').trigger('click');
    await flushPromises();

    expect(wrapper.find('main h1').text()).toBe('A page');
    expect(document.activeElement).toBe(wrapper.find('main h1').element);
  });

  it('never stays on a protected page when the logout navigation fails', async () => {
    const wrapper = await mountApp(true, '/composer');
    const router = wrapper.vm.$router;
    let homeAttempts = 0;
    router.beforeEach((to) => {
      if (to.name === 'home' && ++homeAttempts === 1) throw new Error('Navigation failed');
    });
    const errors: unknown[] = [];
    wrapper.vm.$.appContext.config.errorHandler = (error) => { errors.push(error); };

    await wrapper.find('.desktop-nav .logout-button').trigger('click');
    await flushPromises();

    expect(homeAttempts).toBe(2);
    expect(errors).toEqual([new Error('Navigation failed')]);
    expect(router.currentRoute.value.name).toBe('home');
    expect(wrapper.find('main h1').text()).toBe('A page');
  });

  it('renders the two live regions, empty and visually hidden, before any message', async () => {
    await mountApp();

    for (const region of [politeRegion(), assertiveRegion()]) {
      expect(region).not.toBeNull();
      expect(region?.getAttribute('aria-atomic')).toBe('true');
      expect(region?.classList.contains('visually-hidden')).toBe(true);
      expect(region?.textContent).toBe('');
    }
    expect(document.querySelectorAll('[aria-live="polite"][role="status"]')).toHaveLength(1);
    expect(document.querySelectorAll('[aria-live="assertive"][role="alert"]')).toHaveLength(1);
  });

  it('announces the logout politely, after focus has reached the home heading', async () => {
    const wrapper = await mountApp(true, '/composer');

    await wrapper.find('.desktop-nav .logout-button').trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.find('main h1').element);
    await waitAnnouncement();

    expect(toast.success).toHaveBeenCalledWith('You have been logged out successfully.', undefined);
    expect(politeRegion()?.textContent).toBe('You have been logged out successfully.');
    expect(document.activeElement).toBe(wrapper.find('main h1').element);
  });

  it('announces a session that ended before start-up, in the assertive region', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'home', component: Page }] });
    await router.push('/');
    useAuthStore().sessionEndReason = 'unauthorized';
    wrapper = mount(App, { attachTo: document.body, global: { plugins: [pinia, router] } });
    await flushPromises();
    await waitAnnouncement();

    expect(toast.warning).toHaveBeenCalledWith('Your session is no longer valid. Please sign in again.', undefined);
    expect(assertiveRegion()?.textContent).toBe('Your session is no longer valid. Please sign in again.');
  });

  it('announces a failed "thanks" in the assertive region', async () => {
    api.sendThanks.mockRejectedValueOnce(new Error('Validation failed: Text too long'));
    const wrapper = await mountApp(true);

    await wrapper.find('.desktop-nav .thanks-button').trigger('click');
    await flushPromises();
    (document.querySelector('.btn-send') as HTMLButtonElement).click();
    await flushPromises();
    await waitAnnouncement();

    expect(assertiveRegion()?.textContent).toBe('Failed to send thanks: Validation failed: Text too long.');
  });
});
