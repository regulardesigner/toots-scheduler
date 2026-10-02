function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Returns a URL-safe random string, used for the OAuth `state` and the PKCE verifier.
 * @param {number} [byteLength] - Random bytes to draw; 32 bytes give 43 characters.
 * @returns {string} A base64url string.
 */
export function createRandomToken(byteLength = 32): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/**
 * Computes the S256 PKCE challenge of a verifier (RFC 7636 §4.2).
 * @param {string} verifier - The PKCE code verifier.
 * @returns {Promise<string>} base64url(SHA-256(verifier)).
 */
export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

/** A PKCE verifier, kept by the app, and its challenge, sent to the instance. */
export interface PkcePair {
  verifier: string;
  challenge: string;
}

/**
 * Creates a fresh PKCE verifier and its S256 challenge.
 * @returns {Promise<PkcePair>} The pair.
 */
export async function createPkcePair(): Promise<PkcePair> {
  const verifier = createRandomToken();
  return { verifier, challenge: await createCodeChallenge(verifier) };
}
