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

    expect(wrapper.find('.character-count').text()).toMatch(/^495\b/);
  });

  it("follows the instance's character limit", async () => {
    const wrapper = mountArea();
    useInstanceStore().maxCharacters = 1000;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.character-count').text()).toMatch(/^995\b/);
  });

  it('counts a long URL as 23 characters and does not truncate the text', () => {
    const wrapper = mountArea(`https://example.com/${'a'.repeat(100)}`);

    expect(wrapper.find('textarea').attributes('maxlength')).toBeUndefined();
    expect(wrapper.find('.character-count').text()).toMatch(/^477\b/);
  });
});
