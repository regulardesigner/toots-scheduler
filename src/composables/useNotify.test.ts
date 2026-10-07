import { describe, it, expect, vi, beforeEach } from 'vitest';

const toast = vi.hoisted(() => ({
  success: vi.fn(() => 'toast-success'),
  info: vi.fn(() => 'toast-info'),
  warning: vi.fn(() => 'toast-warning'),
  error: vi.fn(() => 'toast-error'),
  dismiss: vi.fn(),
}));
vi.mock('vue-toastification', () => ({ useToast: () => toast }));

const announce = vi.hoisted(() => vi.fn());
vi.mock('./useAnnouncer', () => ({ useAnnouncer: () => ({ announce }) }));

import { useNotify } from './useNotify';

describe('useNotify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the toast and announces success and info politely', () => {
    const notify = useNotify();

    expect(notify.success('Saved.')).toBe('toast-success');
    expect(notify.info('For your information.')).toBe('toast-info');

    expect(toast.success).toHaveBeenCalledWith('Saved.', undefined);
    expect(toast.info).toHaveBeenCalledWith('For your information.', undefined);
    expect(announce).toHaveBeenNthCalledWith(1, 'Saved.', { assertive: false });
    expect(announce).toHaveBeenNthCalledWith(2, 'For your information.', { assertive: false });
  });

  it('shows the toast and announces warnings and errors assertively', () => {
    const notify = useNotify();

    expect(notify.warning('Careful.')).toBe('toast-warning');
    expect(notify.error('It failed.')).toBe('toast-error');

    expect(toast.warning).toHaveBeenCalledWith('Careful.', undefined);
    expect(toast.error).toHaveBeenCalledWith('It failed.', undefined);
    expect(announce).toHaveBeenNthCalledWith(1, 'Careful.', { assertive: true });
    expect(announce).toHaveBeenNthCalledWith(2, 'It failed.', { assertive: true });
  });

  it('passes the toast options through, and dismisses through the toast', () => {
    const notify = useNotify();
    const onClick = vi.fn();

    notify.warning('Expiring.', { timeout: 1000, onClick });
    notify.dismiss('toast-warning');

    expect(toast.warning).toHaveBeenCalledWith('Expiring.', { timeout: 1000, onClick });
    expect(toast.dismiss).toHaveBeenCalledWith('toast-warning');
  });
});
