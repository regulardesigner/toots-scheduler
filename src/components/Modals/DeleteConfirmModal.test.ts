import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DeleteConfirmModal from './DeleteConfirmModal.vue';

describe('DeleteConfirmModal', () => {
  it('renders the toot preview as text', () => {
    const wrapper = mount(DeleteConfirmModal, { props: { tootPreview: '<b>Hello</b>' } });
    expect(wrapper.find('.toot-preview').text()).toBe('<b>Hello</b>');
    expect(wrapper.find('.toot-preview b').exists()).toBe(false);
    expect(wrapper.find('#delete-title').text()).toBe('Delete scheduled toot?');
  });

  it('hides the preview block when the preview is empty', () => {
    const wrapper = mount(DeleteConfirmModal, { props: { tootPreview: '' } });
    expect(wrapper.find('.toot-preview').exists()).toBe(false);
  });

  it('emits confirm when Delete is clicked', async () => {
    const wrapper = mount(DeleteConfirmModal, { props: { tootPreview: 'x' } });
    await wrapper.find('.btn-delete').trigger('click');
    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(wrapper.emitted('cancel')).toBeUndefined();
  });

  it('emits cancel when Cancel is clicked', async () => {
    const wrapper = mount(DeleteConfirmModal, { props: { tootPreview: 'x' } });
    await wrapper.find('.btn-cancel').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
