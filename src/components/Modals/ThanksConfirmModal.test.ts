import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ThanksConfirmModal from './ThanksConfirmModal.vue';

describe('ThanksConfirmModal', () => {
  it('shows the exact message as text', () => {
    const wrapper = mount(ThanksConfirmModal, { props: { message: '<b>Hi</b> CC: @dams@disabled.social' } });
    expect(wrapper.find('.thanks-preview').text()).toBe('<b>Hi</b> CC: @dams@disabled.social');
    expect(wrapper.find('.thanks-preview b').exists()).toBe(false);
  });

  it('emits confirm or cancel', async () => {
    const wrapper = mount(ThanksConfirmModal, { props: { message: 'Hi' } });
    await wrapper.find('.btn-send').trigger('click');
    await wrapper.find('.btn-cancel').trigger('click');
    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
