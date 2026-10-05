import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ControlsBar from './ControlsBar.vue';

const baseProps = {
  scheduledDate: '',
  scheduledTime: '',
  visibility: 'public' as const,
  language: 'en',
  isEditing: false,
};

describe('ControlsBar', () => {
  it('enables the submit button when idle', () => {
    const button = mount(ControlsBar, { props: baseProps }).find('button[type="submit"]');
    expect(button.attributes('disabled')).toBeUndefined();
    expect(button.text()).toBe('Schedule');
  });

  it('disables the submit button while submitting', () => {
    const button = mount(ControlsBar, { props: { ...baseProps, isSubmitting: true } }).find('button[type="submit"]');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.text()).toBe('Scheduling…');
  });

  it('shows the update labels in edit mode', () => {
    expect(mount(ControlsBar, { props: { ...baseProps, isEditing: true } }).find('button[type="submit"]').text()).toBe('Update');
    expect(mount(ControlsBar, { props: { ...baseProps, isEditing: true, isSubmitting: true } }).find('button[type="submit"]').text()).toBe('Updating…');
  });
});
