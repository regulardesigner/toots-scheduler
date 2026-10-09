import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTimeZone, UNKNOWN_TIME_ZONE } from './timeZone';

function browserTimeZone(timeZone: string | undefined): void {
  vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
    resolvedOptions: () => ({ timeZone }),
  } as unknown as Intl.DateTimeFormat);
}

describe('getTimeZone', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the browser's time zone", () => {
    browserTimeZone('Europe/Stockholm');
    expect(getTimeZone()).toBe('Europe/Stockholm');
  });

  it('says "local time zone" when the browser does not tell', () => {
    browserTimeZone(undefined);
    expect(getTimeZone()).toBe(UNKNOWN_TIME_ZONE);

    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => { throw new RangeError('Unsupported'); });
    expect(getTimeZone()).toBe(UNKNOWN_TIME_ZONE);
  });
});
