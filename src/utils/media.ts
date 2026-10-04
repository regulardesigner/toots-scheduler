/** Image types Mastodon accepts that this app lets users attach. */
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];

/** Default Mastodon image size limit (instances may allow more). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Mastodon allows up to 4 media attachments per toot. */
export const MAX_IMAGES_PER_TOOT = 4;

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', heic: 'image/heic', heif: 'image/heif',
};

/** For the file picker: MIME types plus extensions, so systems that don't know HEIC/AVIF still offer them. */
export const ACCEPTED_IMAGE_FILES = [...SUPPORTED_IMAGE_TYPES, ...Object.keys(EXTENSION_TYPES).map(extension => `.${extension}`)].join(',');

/** The file's type, guessed from its extension when the browser doesn't know it. */
function imageType(file: File): string {
  if (file.type) return file.type;
  const dot = file.name.lastIndexOf('.');
  return dot === -1 ? '' : EXTENSION_TYPES[file.name.slice(dot + 1).toLowerCase()] ?? '';
}

/**
 * Explains why a file can't be attached, or returns null when it can. Checked before
 * uploading, including for drag and drop where the file picker's `accept` doesn't apply;
 * the instance stays the final authority.
 * @param {File} file - The file to check.
 * @returns {string | null} A message for the user, or null.
 */
export function getImageRejection(file: File): string | null {
  if (!SUPPORTED_IMAGE_TYPES.includes(imageType(file))) {
    return `"${file.name}" is not a supported image (JPEG, PNG, GIF, WebP, AVIF or HEIC).`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}" is larger than 8 MB.`;
  }
  return null;
}
