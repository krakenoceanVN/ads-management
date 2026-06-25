import { useState, useCallback } from 'react';
import { type QuarantineResult } from '../lib/bffApi';
import { quarantineRecords } from '../lib/bffApi';
import type { QuarantineScope, QuarantineParams } from '../lib/bffTypes';

export { type QuarantineScope };

export interface UseQuarantineActionOptions {
  scope: QuarantineScope;
  targetId: string;
  targetName: string;
}

export interface UseQuarantineActionReturn {
  open: boolean;
  loading: boolean;
  error: string | null;
  result: QuarantineResult | null;
  targetName: string;
  openModal: () => void;
  closeModal: () => void;
  confirm: (params: Omit<QuarantineParams, 'scope' | 'advertiserId' | 'adSiteId'>) => Promise<QuarantineResult | null>;
}

export function useQuarantineAction(options: UseQuarantineActionOptions): UseQuarantineActionReturn {
  const { scope, targetId, targetName } = options;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuarantineResult | null>(null);

  const openModal = useCallback(() => {
    setError(null);
    setResult(null);
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setError(null);
    setResult(null);
  }, []);

  const confirm = useCallback(async (params: Omit<QuarantineParams, 'scope' | 'advertiserId' | 'adSiteId'>): Promise<QuarantineResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const fullParams: QuarantineParams = {
        ...params,
        scope,
        advertiserId: scope === 'advertiser' ? targetId : undefined,
        adSiteId: scope === 'media' ? targetId : undefined,
      };
      const res = await quarantineRecords(fullParams);
      // Keep the modal open so the success screen (driven by `result`) is shown.
      // The user dismisses it via the "Đóng" button (closeModal), which clears state.
      setResult(res);
      return res;
    } catch (err: any) {
      const message = err?.message || err?.error || 'Đã xảy ra lỗi khi cô lập dữ liệu';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [scope, targetId]);

  return {
    open,
    loading,
    error,
    result,
    targetName,
    openModal,
    closeModal,
    confirm,
  };
}
