import axios from 'axios';

/**
 * Turns an API or runtime error into a message for the user.
 * @param {unknown} error - What was thrown.
 * @returns {string} The instance's error message when there is one, otherwise a generic one.
 */
export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || error.message || 'API request failed';
  }
  return error instanceof Error && error.message ? error.message : 'An unknown error occurred';
}
