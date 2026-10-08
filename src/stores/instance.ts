import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useAuthStore } from './auth';
import { useMastodonApi } from '../composables/useMastodonApi';
import {
  DEFAULT_MAX_CHARACTERS,
  DEFAULT_MAX_IMAGE_BYTES,
  DEFAULT_MAX_MEDIA_ATTACHMENTS,
  SUPPORTED_IMAGE_TYPES,
} from '../config/constants';
import { logError } from '../utils/logError';
import { usableImageTypes } from '../utils/media';

/**
 * Creates a Pinia store for the signed-in instance's limits (toot length, images per toot,
 * image size and types). It reads them after every sign-in or restored session and goes back
 * to Mastodon's defaults on sign-out, on an account switch, or when the instance can't tell.
 * @returns {Object} The instance store with its limits.
 */
export const useInstanceStore = defineStore('instance', () => {
  const auth = useAuthStore();

  const maxCharacters = ref(DEFAULT_MAX_CHARACTERS);
  const maxMediaAttachments = ref(DEFAULT_MAX_MEDIA_ATTACHMENTS);
  const imageSizeLimit = ref(DEFAULT_MAX_IMAGE_BYTES);
  const supportedMimeTypes = ref<string[]>([...SUPPORTED_IMAGE_TYPES]);
  /** True once the instance gave its text limit; until then maxCharacters is a guess, not to be enforced. */
  const hasCharacterLimit = ref(false);
  /** True once the instance gave its images-per-toot limit; until then maxMediaAttachments is a guess. */
  const hasMediaLimit = ref(false);

  function reset(): void {
    maxCharacters.value = DEFAULT_MAX_CHARACTERS;
    maxMediaAttachments.value = DEFAULT_MAX_MEDIA_ATTACHMENTS;
    imageSizeLimit.value = DEFAULT_MAX_IMAGE_BYTES;
    supportedMimeTypes.value = [...SUPPORTED_IMAGE_TYPES];
    hasCharacterLimit.value = false;
    hasMediaLimit.value = false;
  }

  /**
   * Reads the current instance's limits. Each missing or invalid one keeps its default, and a
   * failed request keeps them all: the instance stays the final judge of every toot.
   */
  async function load(): Promise<void> {
    // Limits read for a previous session must not apply to the current one.
    const token = auth.accessToken;
    if (!token) return;
    try {
      const configuration = await useMastodonApi().getInstanceConfiguration();
      if (auth.accessToken !== token) return;
      maxCharacters.value = configuration.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
      maxMediaAttachments.value = configuration.maxMediaAttachments ?? DEFAULT_MAX_MEDIA_ATTACHMENTS;
      imageSizeLimit.value = configuration.imageSizeLimit ?? DEFAULT_MAX_IMAGE_BYTES;
      supportedMimeTypes.value = usableImageTypes(configuration.supportedMimeTypes);
      hasCharacterLimit.value = configuration.maxCharacters !== undefined;
      hasMediaLimit.value = configuration.maxMediaAttachments !== undefined;
    } catch (error) {
      logError('Could not read the instance limits, using the defaults', error);
    }
  }

  // Sign-in, restored session, account switch in another tab, sign-out: always start from the defaults.
  watch(() => auth.accessToken, (token, previous) => {
    if (token === previous) return;
    reset();
    if (token) void load();
  }, { immediate: true });

  return {
    /** Longest toot the instance accepts, in characters. */
    maxCharacters,
    /** Most images per toot. */
    maxMediaAttachments,
    /** Largest image, in bytes. */
    imageSizeLimit,
    /** Image MIME types the app can attach on this instance (images only, never empty). */
    supportedMimeTypes,
    /** Whether maxCharacters comes from the instance (false: the default, not to be enforced). */
    hasCharacterLimit,
    /** Whether maxMediaAttachments comes from the instance (false: the default, not to be enforced). */
    hasMediaLimit,
  };
});
