import { describe, it, expect } from 'vitest';
import { getImageRejection, MAX_IMAGE_BYTES } from './media';

function file(name: string, type: string, size = 10): File {
  const created = new File(['x'], name, { type });
  Object.defineProperty(created, 'size', { value: size });
  return created;
}

describe('getImageRejection', () => {
  it('accepts the image types Mastodon supports', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic']) {
      expect(getImageRejection(file('a', type))).toBeNull();
    }
  });

  it('refuses other types, including SVG and a missing type', () => {
    expect(getImageRejection(file('doc.pdf', 'application/pdf'))).toBe('"doc.pdf" is not a supported image (JPEG, PNG, GIF, WebP, AVIF or HEIC).');
    expect(getImageRejection(file('logo.svg', 'image/svg+xml'))).not.toBeNull();
    expect(getImageRejection(file('noext', ''))).not.toBeNull();
  });

  it('refuses an image over 8 MB', () => {
    expect(getImageRejection(file('big.png', 'image/png', MAX_IMAGE_BYTES + 1))).toBe('"big.png" is larger than 8 MB.');
    expect(getImageRejection(file('max.png', 'image/png', MAX_IMAGE_BYTES))).toBeNull();
  });

  it('also guesses the type when the browser reports a generic binary type', () => {
    expect(getImageRejection(file('photo.heic', 'application/octet-stream'))).toBeNull();
    expect(getImageRejection(file('archive.zip', 'application/octet-stream'))).not.toBeNull();
  });

  it('guesses the type from the extension when the browser reports none', () => {
    expect(getImageRejection(file('photo.HEIC', ''))).toBeNull();
    expect(getImageRejection(file('photo.avif', ''))).toBeNull();
    expect(getImageRejection(file('notes.txt', ''))).not.toBeNull();
  });
});
