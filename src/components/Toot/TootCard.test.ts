import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { format } from 'date-fns';
import { defineComponent, h } from 'vue';
import TootCard from './TootCard.vue';
import { getTimeZone } from '../../utils/timeZone';

const base = { scheduledAt: '2031-01-01T12:00:00.000Z', text: 'Hello' };

function mountCard(props: Record<string, unknown> = {}) {
  return mount(TootCard, { props: { id: '1', ...base, ...props } });
}

describe('TootCard', () => {
  it('gives each sensitive card its own toggle, so a label only reveals its own toot', async () => {
    const TwoCards = defineComponent({
      render: () => [
        h(TootCard, { id: 'a', ...base, sensitive: true, spoilerText: 'Spoiler A' }),
        h(TootCard, { id: 'b', ...base, sensitive: true, spoilerText: 'Spoiler B' }),
      ],
    });
    const wrapper = mount(TwoCards);
    const [cardA, cardB] = wrapper.findAll('.toot-card');

    expect(cardA.find('input').attributes('id')).toBe('sensitive-a');
    expect(cardB.find('input').attributes('id')).toBe('sensitive-b');
    expect(cardA.find('label').attributes('for')).toBe('sensitive-a');
    expect(cardB.find('label').attributes('for')).toBe('sensitive-b');

    await cardB.find('input').setValue(true);

    expect(cardB.find('.toot-content p').classes()).not.toContain('blurred');
    expect(cardA.find('.toot-content p').classes()).toContain('blurred');
  });

  it('names the toggle after what it does', () => {
    const label = mountCard({ sensitive: true, spoilerText: 'Spoiler' }).find('label');

    expect(label.text()).toBe('Show the content behind this warning: Spoiler');
  });

  it('emits edit and delete with its id', async () => {
    const wrapper = mountCard({ id: '42' });

    await wrapper.find('.edit-button').trigger('click');
    await wrapper.find('.delete-button').trigger('click');

    expect(wrapper.emitted('edit')).toEqual([['42']]);
    expect(wrapper.emitted('delete')).toEqual([['42']]);
  });

  it('shows only what is being done to this toot', () => {
    const idle = mountCard();
    expect(idle.find('.edit-button').text()).toBe('Edit');
    expect(idle.find('.delete-button').text()).toBe('Delete');
    expect(idle.find('.delete-button').attributes('disabled')).toBeUndefined();

    const deleting = mountCard({ pendingAction: 'delete' });
    expect(deleting.find('.edit-button').text()).toBe('Edit');
    expect(deleting.find('.delete-button').text()).toBe('Deleting…');
    expect(deleting.find('.edit-button').attributes('disabled')).toBeDefined();
    expect(deleting.find('.delete-button').attributes('disabled')).toBeDefined();

    expect(mountCard({ pendingAction: 'update' }).find('.edit-button').text()).toBe('Updating…');
  });

  it('disables its buttons, without claiming progress, while another toot is being changed', () => {
    const wrapper = mountCard({ busy: true });

    expect(wrapper.find('.edit-button').text()).toBe('Edit');
    expect(wrapper.find('.delete-button').text()).toBe('Delete');
    expect(wrapper.find('.edit-button').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.delete-button').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.toot-card').attributes('aria-busy')).toBeUndefined();
  });

  it('is marked busy only while something is being done to it', () => {
    expect(mountCard().find('.toot-card').attributes('aria-busy')).toBeUndefined();
    expect(mountCard({ pendingAction: 'delete' }).find('.toot-card').attributes('aria-busy')).toBe('true');
  });

  it('shows the scheduled date in local time, with the time zone in parentheses', () => {
    const localDate = format(new Date(base.scheduledAt), 'MMM d, yyyy HH:mm');

    expect(mountCard().find('.meta-label').text()).toBe(`Scheduled for: ${localDate} (${getTimeZone()})`);
  });

  it('shows a toot whose params came back null as a plain public toot', () => {
    const card = mountCard({ visibility: null, language: null, sensitive: null, spoilerText: null, poll: null });

    expect(card.find('.sensitive-warning').exists()).toBe(false);
    expect(card.find('.toot-footer').text()).toBe('Public toot in Unknown');
  });

  it('names the language from the shared list, and shows a language it does not list by its code', () => {
    expect(mountCard({ language: 'fr' }).find('.toot-footer').text()).toContain('toot in Français');
    expect(mountCard({ language: 'eo' }).find('.toot-footer').text()).toContain('toot in eo');
    expect(mountCard().find('.toot-footer').text()).toContain('toot in Unknown');
  });
});
