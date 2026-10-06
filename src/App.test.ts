import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { defineComponent, h } from 'vue';
import { useAuthStore } from './stores/auth';

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() }));
vi.mock('vue-toastification', () => ({ useToast: () => toast }));

import App from './App.vue';

const Page = defineComponent({ render: () => h('h1', { tabindex: -1 }, 'A page') });

let wrapper: VueWrapper | undefined;

async function mountApp(signedIn = false) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'home', component: Page }] });
  await router.push('/');
  await router.isReady();
  const pinia = createPinia();
  setActivePinia(pinia);
  if (signedIn) useAuthStore().accessToken = 'token';
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

  it('names the account navigation, and puts focus on the page heading after logout', async () => {
    const wrapper = await mountApp(true);
    expect(wrapper.findAll('nav[aria-label="Account"]')).toHaveLength(2);

    await wrapper.find('.desktop-nav .logout-button').trigger('click');
    await flushPromises();

    expect(document.activeElement).toBe(wrapper.find('main h1').element);
  });
});
