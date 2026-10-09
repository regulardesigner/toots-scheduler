import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LandingPage from './LandingPage.vue';

describe('LandingPage', () => {
  it('has one <h1> and no <main> of its own (App provides it)', () => {
    const wrapper = mount(LandingPage);

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('main').exists()).toBe(false);
  });
});
