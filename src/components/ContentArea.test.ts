import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import ContentArea from './ContentArea.vue';
import { useInstanceStore } from '../stores/instance';

let pinia: Pinia;

function mountArea(modelValue = 'Hello') {
  return mount(ContentArea, {
    props: { modelValue, hasPoll: false, hasMedia: false },
    global: { plugins: [pinia] },
  });
}

describe('ContentArea', () => {
  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("uses Mastodon's default limit until the instance answers", () => {
    const wrapper = mountArea();

    expect(wrapper.find('textarea').attributes('maxlength')).toBe('500');
    expect(wrapper.find('.character-count').text()).toMatch(/^495\b/);
  });

  it("follows the instance's character limit", async () => {
    const wrapper = mountArea();
    useInstanceStore().maxCharacters = 1000;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('textarea').attributes('maxlength')).toBe('1000');
    expect(wrapper.find('.character-count').text()).toMatch(/^995\b/);
  });
});
