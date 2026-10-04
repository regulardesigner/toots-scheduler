import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import type { MastodonMediaAttachment } from '../types/mastodon';

const api = vi.hoisted(() => ({ uploadMedia: vi.fn(), updateMediaMetadata: vi.fn() }));
vi.mock('../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));

import MediaUpload from './MediaUpload.vue';

function media(id: string): MastodonMediaAttachment {
  return { id, type: 'image', url: `https://masto.example/${id}.png`, preview_url: `https://masto.example/${id}.png` };
}

function drop(wrapper: ReturnType<typeof mount>, files: File[]) {
  return wrapper.find('.upload-area').trigger('drop', { dataTransfer: { files } });
}

describe('MediaUpload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('refuses a dropped file that is not a supported image, without uploading it', async () => {
    const wrapper = mount(MediaUpload, { props: { modelValue: [] } });

    await drop(wrapper, [new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })]);
    await flushPromises();

    expect(api.uploadMedia).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('"doc.pdf" is not a supported image (JPEG, PNG, GIF, WebP, AVIF or HEIC).');
  });

  it('keeps every image when several are uploaded at once', async () => {
    api.uploadMedia.mockResolvedValueOnce(media('m1')).mockResolvedValueOnce(media('m2'));
    const wrapper = mount(MediaUpload, { props: { modelValue: [] } });

    await drop(wrapper, [
      new File(['a'], 'same.png', { type: 'image/png' }),
      new File(['b'], 'same.png', { type: 'image/png' }),
    ]);
    await flushPromises();

    const events = wrapper.emitted('update:modelValue') as MastodonMediaAttachment[][][];
    expect(events.at(-1)?.[0].map(item => item.id)).toEqual(['m1', 'm2']);
  });

  it('refuses more than 4 images', async () => {
    const wrapper = mount(MediaUpload, { props: { modelValue: [media('a'), media('b'), media('c')] } });

    await drop(wrapper, [new File(['a'], '1.png', { type: 'image/png' }), new File(['b'], '2.png', { type: 'image/png' })]);
    await flushPromises();

    expect(api.uploadMedia).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('Maximum 4 images allowed');
  });
});
