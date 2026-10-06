import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { defineComponent, h } from 'vue';

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() }));
vi.mock('vue-toastification', () => ({ useToast: () => toast }));

import App from './App.vue';

const Page = defineComponent({ render: () => h('h1', 'A page') });

async function mountApp() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'home', component: Page }] });
  await router.push('/');
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [createPinia(), router] } });
  await flushPromises();
  return wrapper;
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the page inside the only <main>, and leaves the <h1> to the page', async () => {
    const wrapper = await mountApp();

    expect(wrapper.findAll('main')).toHaveLength(1);
    expect(wrapper.find('main h1').text()).toBe('A page');
    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('.header-title').element.tagName).toBe('P');
  });
});
