/** Image types Mastodon accepts that this app lets users attach (used when the instance gives no list). */
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];

/** Default Mastodon image size limit, used when the instance gives none. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Mastodon's default number of media attachments per toot, used when the instance gives none. */
export const MAX_IMAGES_PER_TOOT = 4;

/** What an image is checked against before upload: the instance's limits, or the defaults above. */
export interface ImageLimits {
  /** Accepted image MIME types. */
  imageTypes: readonly string[];
  /** Largest accepted image, in bytes. */
  maxImageBytes: number;
}

/** The limits used until the instance gives its own. */
export const DEFAULT_IMAGE_LIMITS: ImageLimits = { imageTypes: SUPPORTED_IMAGE_TYPES, maxImageBytes: MAX_IMAGE_BYTES };

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', heic: 'image/heic', heif: 'image/heif',
};

/** Names shown to the user; HEIF is presented as HEIC, the name people know. */
const TYPE_NAMES: Record<string, string> = {
  'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/gif': 'GIF', 'image/webp': 'WebP',
  'image/avif': 'AVIF', 'image/heic': 'HEIC', 'image/heif': 'HEIC',
};

/**
 * The image types this app can attach on an instance: the instance's own list, kept to the
 * images the app supports. Without a usable list (none sent, or no supported image in it)
 * the app's default list applies; the instance still checks every upload.
 * @param {readonly string[] | undefined} instanceTypes - `supported_mime_types` from the instance.
 * @returns {string[]} The image MIME types to accept.
 */
export function usableImageTypes(instanceTypes: readonly string[] | undefined): string[] {
  if (!instanceTypes) return [...SUPPORTED_IMAGE_TYPES];
  const offered = new Set(instanceTypes.map(type => type.toLowerCase()));
  const usable = SUPPORTED_IMAGE_TYPES.filter(type => offered.has(type));
  return usable.length > 0 ? usable : [...SUPPORTED_IMAGE_TYPES];
}

/**
 * The file picker's `accept` value: the MIME types plus their extensions, so systems that
 * don't know HEIC or AVIF still offer those files.
 * @param {readonly string[]} imageTypes - The accepted image MIME types.
 * @returns {string} e.g. "image/png,.png".
 */
export function acceptedImageFiles(imageTypes: readonly string[]): string {
  const extensions = Object.entries(EXTENSION_TYPES)
    .filter(([, type]) => imageTypes.includes(type))
    .map(([extension]) => `.${extension}`);
  return [...imageTypes, ...extensions].join(',');
}

/**
 * Names the accepted image types for the user.
 * @param {readonly string[]} imageTypes - The accepted image MIME types.
 * @returns {string} e.g. "JPEG, PNG or GIF".
 */
export function describeImageTypes(imageTypes: readonly string[]): string {
  const names = [...new Set(imageTypes.map(type => TYPE_NAMES[type] ?? type))];
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/**
 * A size in megabytes, rounded down to one decimal so a limit is never overstated.
 * @param {number} bytes - The size in bytes.
 * @returns {string} e.g. "8", "16" or "2.5".
 */
export function formatMegabytes(bytes: number): string {
  return String(Math.floor((bytes / (1024 * 1024)) * 10) / 10);
}

/** The file's type, guessed from its extension when the browser doesn't know it (empty or generic binary type). */
function imageType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const dot = file.name.lastIndexOf('.');
  return dot === -1 ? '' : EXTENSION_TYPES[file.name.slice(dot + 1).toLowerCase()] ?? '';
}

/**
 * Explains why a file can't be attached, or returns null when it can. Checked before
 * uploading, including for drag and drop where the file picker's `accept` doesn't apply;
 * the instance stays the final authority.
 * @param {File} file - The file to check.
 * @param {ImageLimits} limits - The accepted types and largest size.
 * @returns {string | null} A message for the user, or null.
 */
export function getImageRejection(file: File, limits: ImageLimits): string | null {
  const type = imageType(file);
  // HEIC and HEIF are the same format under two names: an instance listing one accepts the other.
  const accepted = limits.imageTypes.includes(type)
    || (type === 'image/heic' && limits.imageTypes.includes('image/heif'))
    || (type === 'image/heif' && limits.imageTypes.includes('image/heic'));
  if (!accepted) {
    return `"${file.name}" is not a supported image (${describeImageTypes(limits.imageTypes)}).`;
  }
  if (file.size > limits.maxImageBytes) {
    return `"${file.name}" is larger than ${formatMegabytes(limits.maxImageBytes)} MB.`;
  }
  return null;
}
