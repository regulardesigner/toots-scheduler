import { describe, it, expect, vi, afterEach } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { describeError, logError } from './logError';

/** A 401 from the instance, as axios builds it: the request config carries the bearer token. */
function unauthorized(): AxiosError {
  const config = { url: 'https://masto.example/api/v1/scheduled_statuses', headers: new AxiosHeaders({ Authorization: 'Bearer secret-token' }) } as InternalAxiosRequestConfig;
  const response = { status: 401, statusText: 'Unauthorized', data: { error: 'The access token is invalid' }, headers: {}, config } as AxiosResponse;
  return new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, null, response);
}

describe('logError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('logs a one-line summary of an API failure, never the request headers', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    // What useMastodonApi throws: the instance's message, with the AxiosError as its cause.
    const error = new Error('The access token is invalid', { cause: unauthorized() });

    logError('Error fetching scheduled toots', error);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual([
      'Error fetching scheduled toots: Error: The access token is invalid (cause: AxiosError: Request failed with status code 401, status 401, code ERR_BAD_REQUEST)',
    ]);
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token');
  });

  it('logs nothing in production', () => {
    vi.stubEnv('DEV', false);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    logError('Upload error', new Error('Boom'));

    expect(log).not.toHaveBeenCalled();
  });
});

describe('describeError', () => {
  it('describes an AxiosError by its message, status and code only', () => {
    expect(describeError(unauthorized())).toBe('AxiosError: Request failed with status code 401, status 401, code ERR_BAD_REQUEST');
    expect(describeError(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe('AxiosError: Network Error, code ERR_NETWORK');
  });

  it('describes other errors by name and message, following a bounded chain of causes', () => {
    expect(describeError(new TypeError('x is undefined'))).toBe('TypeError: x is undefined');

    const looped = new Error('Outer');
    looped.cause = looped;
    expect(describeError(looped)).toBe('Error: Outer (cause: Error: Outer (cause: Error: Outer (cause: Error: Outer)))');
  });

  it('never prints a value that is not an Error', () => {
    expect(describeError({ headers: { Authorization: 'Bearer secret-token' } })).toBe('A non-error value was thrown (object)');
    expect(describeError('Bearer secret-token')).toBe('A non-error value was thrown (string)');
  });
});
