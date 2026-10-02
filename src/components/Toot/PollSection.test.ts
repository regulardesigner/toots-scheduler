import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PollSection from './PollSection.vue';
import type { PollFormState } from '../../types/mastodon';

describe('PollSection', () => {
  it('emits the poll duration as a number', async () => {
    const wrapper = mount(PollSection);

    await wrapper.find('select').setValue('3600');

    const events = wrapper.emitted('update:modelValue') as [PollFormState][];
    const last = events[events.length - 1][0];
    expect(last.expiresIn).toBe(3600);
    expect(typeof last.expiresIn).toBe('number');
  });
});
