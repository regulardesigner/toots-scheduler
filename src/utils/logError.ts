import axios from 'axios';

/** How many causes are followed: enough for a wrapped API error, bounded for a cycle. */
const MAX_CAUSE_DEPTH = 3;

/**
 * A short description of what was thrown, safe for the console. An AxiosError holds the request
 * config, headers included (`Authorization: Bearer …`), and the response body: only its message,
 * HTTP status and error code are kept. A value that is not an Error is not printed at all.
 * @param {unknown} error - What was thrown; often an Error whose `cause` is the AxiosError.
 * @param {number} [depth] - Causes already followed (internal).
 * @returns {string} e.g. `Error: Not found (cause: AxiosError: Request failed with status code 404, status 404, code ERR_BAD_REQUEST)`.
 */
export function describeError(error: unknown, depth = 0): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return [`AxiosError: ${error.message}`, status ? `status ${status}` : '', error.code ? `code ${error.code}` : '']
      .filter(Boolean)
      .join(', ');
  }
  if (error instanceof Error) {
    const cause = error.cause !== undefined && depth < MAX_CAUSE_DEPTH
      ? ` (cause: ${describeError(error.cause, depth + 1)})`
      : '';
    return `${error.name}: ${error.message}${cause}`;
  }
  return `A non-error value was thrown (${typeof error})`;
}

/**
 * Logs an error for developers, in DEV only (production builds drop the console anyway):
 * one summary line, plus the stack of a plain Error.
 * The only console output of the app: never pass a request, a response or a token to the console directly.
 * @param {string} context - What failed, e.g. "Upload error".
 * @param {unknown} error - What was thrown.
 */
export function logError(context: string, error: unknown): void {
  if (!import.meta.env.DEV) return;
  // A stack is `name: message` plus frame locations: no config, headers or body. An AxiosError stays one line.
  const stack = error instanceof Error && !axios.isAxiosError(error) ? error.stack : undefined;
  // eslint-disable-next-line no-console -- the one sanctioned console call, see above
  console.error(`${context}: ${describeError(error)}`, ...(stack ? [`\n${stack}`] : []));
}
