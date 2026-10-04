/** Image types Mastodon accepts that this app lets users attach. */
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];

/** Default Mastodon image size limit (instances may allow more). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Mastodon allows up to 4 media attachments per toot. */
export const MAX_IMAGES_PER_TOOT = 4;

/**
 * Explains why a file can't be attached, or returns null when it can. Checked before
 * uploading, including for drag and drop where the file picker's `accept` doesn't apply;
 * the instance stays the final authority.
 * @param {File} file - The file to check.
 * @returns {string | null} A message for the user, or null.
 */
export function getImageRejection(file: File): string | null {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    return `"${file.name}" is not a supported image (JPEG, PNG, GIF, WebP, AVIF or HEIC).`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}" is larger than 8 MB.`;
  }
  return null;
}
