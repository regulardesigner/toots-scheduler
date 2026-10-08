import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

const auth = vi.hoisted(() => ({
  accessToken: 'token' as string | null,
  instance: 'https://masto.example' as string | null,
  handleUnauthorized: vi.fn(),
}));

vi.mock('../stores/auth', () => ({ useAuthStore: () => auth }));

import { createApiClient } from './api';

function clientRespondingWith(status: number) {
  const seen: InternalAxiosRequestConfig[] = [];
  const api = createApiClient();
  const adapter: AxiosAdapter = async (config) => {
    seen.push(config);
    const response = { data: {}, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      throw Object.assign(new Error(`Request failed with status code ${status}`), {
        isAxiosError: true,
        config,
        response,
      });
    }
    return response;
  };
  api.defaults.adapter = adapter;
  return { api, seen };
}

describe('createApiClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.accessToken = 'token';
    auth.instance = 'https://masto.example';
  });

  it('attaches the token to instance requests', async () => {
    const { api, seen } = clientRespondingWith(200);

    await api.get('https://masto.example/api/v1/accounts/verify_credentials');

    expect(seen[0].headers.Authorization).toBe('Bearer token');
  });

  it('never attaches the token to another origin, including a lookalike', async () => {
    const { api, seen } = clientRespondingWith(200);

    await api.get('https://masto.example.evil.com/steal');
    await api.get('https://evil.example/steal');
    await api.get('https://masto.example@evil.example/steal');

    seen.forEach(config => expect(config.headers.Authorization).toBeUndefined());
  });

  it('ends the session when the instance answers 401', async () => {
    const { api } = clientRespondingWith(401);

    await expect(api.get('https://masto.example/api/v1/scheduled_statuses')).rejects.toThrow('401');

    expect(auth.handleUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('ignores a 401 from another origin and other errors', async () => {
    await expect(clientRespondingWith(401).api.get('https://other.example/x')).rejects.toThrow();
    await expect(clientRespondingWith(500).api.get('https://masto.example/api/v1/x')).rejects.toThrow();

    expect(auth.handleUnauthorized).not.toHaveBeenCalled();
  });

  it('ignores a 401 for a request sent with an older token', async () => {
    const { api } = clientRespondingWith(401);
    const send = api.defaults.adapter as AxiosAdapter;
    api.defaults.adapter = async (config) => {
      // The request already left with the old token; then another tab switches account.
      auth.accessToken = 'new-token';
      return send(config);
    };

    await expect(api.get('https://masto.example/api/v1/scheduled_statuses')).rejects.toThrow('401');

    expect(auth.handleUnauthorized).not.toHaveBeenCalled();
  });
});
