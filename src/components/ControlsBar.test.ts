import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ControlsBar from './ControlsBar.vue';
import { getTimeZone } from '../utils/timeZone';
import { LANGUAGES } from '../config/constants';

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

  it('names the time zone the date and time are read in', () => {
    const wrapper = mount(ControlsBar, { props: baseProps });

    expect(wrapper.find('#time-zone-hint').text()).toBe(`Time zone: ${getTimeZone()}`);
    expect(wrapper.find('#scheduled-date').attributes('aria-describedby')).toBe('time-zone-hint');
    expect(wrapper.find('#scheduled-time').attributes('aria-describedby')).toBe('time-zone-hint');
  });

  it('offers the languages of the shared list, by their own names', () => {
    const options = mount(ControlsBar, { props: baseProps }).findAll('#language option');

    expect(options.map(option => option.attributes('value'))).toEqual(LANGUAGES.map(language => language.code));
    expect(options.map(option => option.text())).toEqual(LANGUAGES.map(language => language.name));
  });
});
