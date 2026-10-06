import { describe, it, expect } from 'vitest';
import {
  acceptedImageFiles,
  DEFAULT_IMAGE_LIMITS,
  describeImageTypes,
  formatMegabytes,
  getImageRejection,
  MAX_IMAGE_BYTES,
  SUPPORTED_IMAGE_TYPES,
  usableImageTypes,
} from './media';

function file(name: string, type: string, size = 10): File {
  const created = new File(['x'], name, { type });
  Object.defineProperty(created, 'size', { value: size });
  return created;
}

describe('getImageRejection', () => {
  it('accepts the image types Mastodon supports', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic']) {
      expect(getImageRejection(file('a', type), DEFAULT_IMAGE_LIMITS)).toBeNull();
    }
  });

  it('refuses other types, including SVG and a missing type', () => {
    expect(getImageRejection(file('doc.pdf', 'application/pdf'), DEFAULT_IMAGE_LIMITS)).toBe('"doc.pdf" is not a supported image (JPEG, PNG, GIF, WebP, AVIF or HEIC).');
    expect(getImageRejection(file('logo.svg', 'image/svg+xml'), DEFAULT_IMAGE_LIMITS)).not.toBeNull();
    expect(getImageRejection(file('noext', ''), DEFAULT_IMAGE_LIMITS)).not.toBeNull();
  });

  it('refuses an image over 8 MB', () => {
    expect(getImageRejection(file('big.png', 'image/png', MAX_IMAGE_BYTES + 1), DEFAULT_IMAGE_LIMITS)).toBe('"big.png" is larger than 8 MB.');
    expect(getImageRejection(file('max.png', 'image/png', MAX_IMAGE_BYTES), DEFAULT_IMAGE_LIMITS)).toBeNull();
  });

  it('also guesses the type when the browser reports a generic binary type', () => {
    expect(getImageRejection(file('photo.heic', 'application/octet-stream'), DEFAULT_IMAGE_LIMITS)).toBeNull();
    expect(getImageRejection(file('archive.zip', 'application/octet-stream'), DEFAULT_IMAGE_LIMITS)).not.toBeNull();
  });

  it('guesses the type from the extension when the browser reports none', () => {
    expect(getImageRejection(file('photo.HEIC', ''), DEFAULT_IMAGE_LIMITS)).toBeNull();
    expect(getImageRejection(file('photo.avif', ''), DEFAULT_IMAGE_LIMITS)).toBeNull();
    expect(getImageRejection(file('notes.txt', ''), DEFAULT_IMAGE_LIMITS)).not.toBeNull();
  });

  it('applies the limits it is given', () => {
    const pngUpTo2MB = { imageTypes: ['image/png'], maxImageBytes: 2 * 1024 * 1024 };
    expect(getImageRejection(file('photo.jpg', 'image/jpeg'), pngUpTo2MB)).toBe('"photo.jpg" is not a supported image (PNG).');
    expect(getImageRejection(file('photo.png', '', 3 * 1024 * 1024), pngUpTo2MB)).toBe('"photo.png" is larger than 2 MB.');
    expect(getImageRejection(file('photo.png', 'image/png', 9 * 1024 * 1024), { ...DEFAULT_IMAGE_LIMITS, maxImageBytes: 16 * 1024 * 1024 })).toBeNull();
  });
});

describe('usableImageTypes', () => {
  it('keeps the instance image types the app supports, in the app order', () => {
    expect(usableImageTypes(['video/mp4', 'image/webp', 'IMAGE/PNG', 'image/svg+xml', 'image/bmp'])).toEqual(['image/png', 'image/webp']);
  });

  it('falls back to the app list without a usable instance list', () => {
    expect(usableImageTypes(undefined)).toEqual(SUPPORTED_IMAGE_TYPES);
    expect(usableImageTypes(['video/mp4', 'audio/mpeg'])).toEqual(SUPPORTED_IMAGE_TYPES);
  });
});

describe('describing the limits', () => {
  it('builds the file picker filter from the accepted types', () => {
    expect(acceptedImageFiles(['image/png'])).toBe('image/png,.png');
    expect(acceptedImageFiles(SUPPORTED_IMAGE_TYPES)).toBe(`${SUPPORTED_IMAGE_TYPES.join(',')},.jpg,.jpeg,.png,.gif,.webp,.avif,.heic,.heif`);
  });

  it('names the accepted types', () => {
    expect(describeImageTypes(SUPPORTED_IMAGE_TYPES)).toBe('JPEG, PNG, GIF, WebP, AVIF or HEIC');
    expect(describeImageTypes(['image/png', 'image/gif'])).toBe('PNG or GIF');
    expect(describeImageTypes(['image/png'])).toBe('PNG');
  });

  it('rounds sizes down to one decimal', () => {
    expect(formatMegabytes(8 * 1024 * 1024)).toBe('8');
    expect(formatMegabytes(16777216)).toBe('16');
    expect(formatMegabytes(2.56 * 1024 * 1024)).toBe('2.5');
  });
});
