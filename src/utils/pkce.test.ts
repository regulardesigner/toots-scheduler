import { describe, it, expect } from 'vitest';
import { createCodeChallenge, createPkcePair, createRandomToken } from './pkce';

describe('pkce', () => {
  it('computes the RFC 7636 appendix B challenge', async () => {
    await expect(createCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'))
      .resolves.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('creates 43-character base64url tokens that differ each time', () => {
    const a = createRandomToken();
    const b = createRandomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).not.toBe(a);
  });

  it('creates a verifier with its matching challenge', async () => {
    const { verifier, challenge } = await createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(createCodeChallenge(verifier)).resolves.toBe(challenge);
  });
});
