import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { MastodonMediaAttachment } from '../types/mastodon';

const api = vi.hoisted(() => ({ uploadMedia: vi.fn(), updateMediaMetadata: vi.fn() }));
vi.mock('../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));

import MediaUpload from './MediaUpload.vue';
import { useInstanceStore } from '../stores/instance';

let pinia: Pinia;

function mountUpload(modelValue: MastodonMediaAttachment[] = []) {
  return mount(MediaUpload, { props: { modelValue }, global: { plugins: [pinia] } });
}

/** An instance that accepts 2 PNG images of up to 2 MB per toot. */
function useSmallInstance(): void {
  const instance = useInstanceStore();
  instance.maxMediaAttachments = 2;
  instance.imageSizeLimit = 2 * 1024 * 1024;
  instance.supportedMimeTypes = ['image/png'];
}

function media(id: string): MastodonMediaAttachment {
  return { id, type: 'image', url: `https://masto.example/${id}.png`, preview_url: `https://masto.example/${id}.png` };
}

function drop(wrapper: ReturnType<typeof mount>, files: File[]) {
  return wrapper.find('.upload-area').trigger('drop', { dataTransfer: { files } });
}

describe('MediaUpload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it('shows a placeholder instead of a broken image when there is no preview yet', () => {
    const wrapper = mountUpload([{ id: 'v1', type: 'video', url: null }]);
    expect(wrapper.find('.media-preview img').exists()).toBe(false);
    expect(wrapper.find('.preview-placeholder').text()).toBe('Processing…');
  });

  it('keeps its alert container in place, empty until an error fills it', async () => {
    const wrapper = mountUpload();
    const alert = wrapper.find('[role="alert"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toBe('');

    await drop(wrapper, [new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })]);
    await flushPromises();

    expect(wrapper.find('[role="alert"]').element).toBe(alert.element);
    expect(alert.text()).toContain('is not a supported image');
  });

  it('refuses a dropped file that is not a supported image, without uploading it', async () => {
    const wrapper = mountUpload();

    await drop(wrapper, [new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })]);
    await flushPromises();

    expect(api.uploadMedia).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('"doc.pdf" is not a supported image (JPEG, PNG, GIF, WebP, AVIF or HEIC).');
    expect(wrapper.find('.error').element.parentElement?.getAttribute('role')).toBe('alert');
  });

  it('keeps every image when several are uploaded at once', async () => {
    api.uploadMedia.mockResolvedValueOnce(media('m1')).mockResolvedValueOnce(media('m2'));
    const wrapper = mountUpload();

    await drop(wrapper, [
      new File(['a'], 'same.png', { type: 'image/png' }),
      new File(['b'], 'same.png', { type: 'image/png' }),
    ]);
    await flushPromises();

    const events = wrapper.emitted('update:modelValue') as MastodonMediaAttachment[][][];
    expect(events.at(-1)?.[0].map(item => item.id)).toEqual(['m1', 'm2']);
  });

  it('refuses more than 4 images', async () => {
    const wrapper = mountUpload([media('a'), media('b'), media('c')]);

    await drop(wrapper, [new File(['a'], '1.png', { type: 'image/png' }), new File(['b'], '2.png', { type: 'image/png' })]);
    await flushPromises();

    expect(api.uploadMedia).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('Maximum 4 images allowed');
  });

  it('ignores a second drop while an upload is running', async () => {
    api.uploadMedia.mockReturnValue(new Promise(() => {}));
    const wrapper = mountUpload();

    await drop(wrapper, [new File(['a'], 'a.png', { type: 'image/png' })]);
    await drop(wrapper, [new File(['b'], 'b.png', { type: 'image/png' })]);

    expect(api.uploadMedia).toHaveBeenCalledTimes(1);
  });

  it('locks removing and describing images while an upload is running', async () => {
    api.uploadMedia.mockReturnValue(new Promise(() => {}));
    const wrapper = mountUpload([media('a')]);

    await drop(wrapper, [new File(['b'], 'b.png', { type: 'image/png' })]);

    expect(wrapper.find('.remove-button').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.edit-alt-button').attributes('disabled')).toBeDefined();
  });

  it('keeps the images already uploaded and names the file that failed', async () => {
    api.uploadMedia.mockResolvedValueOnce(media('m1')).mockRejectedValueOnce(new Error('File too large'));
    const wrapper = mountUpload();

    await drop(wrapper, [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })]);
    await flushPromises();

    const events = wrapper.emitted('update:modelValue') as MastodonMediaAttachment[][][];
    expect(events.at(-1)?.[0].map(item => item.id)).toEqual(['m1']);
    expect(wrapper.find('.error').text()).toBe('Could not upload "b.png": File too large');
  });

  it("describes the instance's limits and filters the file picker with them", async () => {
    const wrapper = mountUpload();
    expect(wrapper.find('.upload-hint').text()).toBe('Up to 4 images, max 8 MB each (JPEG, PNG, GIF, WebP, AVIF or HEIC)');

    useSmallInstance();
    await flushPromises();

    expect(wrapper.find('.upload-hint').text()).toBe('Up to 2 images, max 2 MB each (PNG)');
    expect(wrapper.find('input[type="file"]').attributes('accept')).toBe('image/png,.png');
  });

  it('refuses a type the instance does not accept, without uploading it', async () => {
    useSmallInstance();
    const wrapper = mountUpload();

    await drop(wrapper, [new File(['a'], 'photo.jpg', { type: 'image/jpeg' })]);
    await flushPromises();

    expect(api.uploadMedia).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('"photo.jpg" is not a supported image (PNG).');
  });

  it('refuses more images, or larger ones, than the instance allows', async () => {
    useSmallInstance();
    const wrapper = mountUpload([media('a')]);

    await drop(wrapper, [new File(['b'], 'b.png', { type: 'image/png' }), new File(['c'], 'c.png', { type: 'image/png' })]);
    await flushPromises();
    expect(wrapper.find('.error').text()).toBe('Maximum 2 images allowed');

    const big = new File(['d'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 3 * 1024 * 1024 });
    await drop(wrapper, [big]);
    await flushPromises();
    expect(wrapper.find('.error').text()).toBe('"big.png" is larger than 2 MB.');

    expect(api.uploadMedia).not.toHaveBeenCalled();
  });
});
