import React from 'react';
import { useAppContext } from '../AppContext';
import type { HardDeleteResult, HardDeleteError } from '../lib/bffApi';

export interface HardDeleteModalProps {
  open: boolean;
  entityName: string;
  loading: boolean;
  error: string;
  result: HardDeleteResult | null;
  onConfirm: () => void;
  onClose: () => void;
  onGoToQuarantine?: () => void;
}

export function HardDeleteModal({
  open,
  entityName,
  loading,
  error,
  result,
  onConfirm,
  onClose,
  onGoToQuarantine,
}: HardDeleteModalProps) {
  const { t } = useAppContext();

  if (!open) return null;

  const isBlocked = result && !result.success;
  const resultCode = result && 'code' in result ? (result as { code: string }).code : null;
  const isLimitation = resultCode === 'LIMITATION';
  const isFinancialBlock = resultCode === 'ENTITY_HAS_FINANCIAL_DATA';
  const isDependencyBlock = resultCode === 'ENTITY_HAS_DEPENDENCIES';
  const isTerminalError = ['FORBIDDEN', 'BAD_REQUEST', 'INTERNAL_ERROR', 'NOT_FOUND'].includes(String(resultCode));
  const isSuccess = result?.success === true;
  const errorData = result && !result.success ? (result as HardDeleteError).data : undefined;
  const dependencies = errorData?.dependencies;
  const dependencyEntries = isDependencyBlock && dependencies && typeof dependencies === 'object'
    ? Object.entries(dependencies as Record<string, unknown>).filter(([, value]) => Number(value) > 0)
    : [];

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{t('hardDeleteConfirm')}</span>
          <button className="modal-close" onClick={() => !loading && onClose()}>x</button>
        </div>
        <div className="modal-body">
          {isSuccess ? (
            <div className="quarantine-warning">
              <div className="quarantine-warning-icon">✅</div>
              <div className="quarantine-warning-text">{t('hardDeleteSuccess')}</div>
            </div>
          ) : isLimitation ? (
            <div className="quarantine-warning">
              <div className="quarantine-warning-icon">⚠️</div>
              <div className="quarantine-warning-text">{(result as HardDeleteError).message}</div>
            </div>
          ) : isFinancialBlock ? (
            <>
              <div className="quarantine-warning">
                <div className="quarantine-warning-icon">⚠️</div>
                <div className="quarantine-warning-text">{t('hardDeleteBlockedTitle')}</div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-sub)', marginTop: '8px', lineHeight: '1.6' }}>
                {t('hardDeleteFinancialMessage')}
              </div>
              {(error || (result as any)?.message) && (
                <div className="form-error" style={{ marginTop: '8px' }}>{error || (result as any).message}</div>
              )}
            </>
          ) : isDependencyBlock ? (
            <>
              <div className="quarantine-warning">
                <div className="quarantine-warning-icon">⚠️</div>
                <div className="quarantine-warning-text">{t('hardDeleteBlockedTitle')}</div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-sub)', marginTop: '8px', lineHeight: '1.6' }}>
                {t('hardDeleteDependencyMessage')}
              </div>
              {dependencyEntries.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: '8px' }}>
                  {dependencyEntries.map(([key, value]) => `${key}: ${value}`).join(', ')}
                </div>
              )}
              {error && <div className="form-error" style={{ marginTop: '8px' }}>{error}</div>}
            </>
          ) : isTerminalError ? (
            <div className="quarantine-warning">
              <div className="quarantine-warning-icon">⚠️</div>
              <div className="quarantine-warning-text">{(result as HardDeleteError).message}</div>
            </div>
          ) : (
            <>
              <div className="quarantine-warning">
                <div className="quarantine-warning-icon">⚠️</div>
                <div className="quarantine-warning-text">
                  {t('hardDeleteWarning')}
                </div>
              </div>
              <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-sub)' }}>
                {t('deleteCannotRecover')}
              </div>
              {entityName && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-main)', fontWeight: 600 }}>
                  {entityName}
                </div>
              )}
              <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-sub)' }}>
                {t('hardDeleteQuestion')}
              </div>
              {error && <div className="form-error" style={{ marginTop: '8px' }}>{error}</div>}
            </>
          )}
        </div>
        <div className="modal-footer">
          {isSuccess ? (
            <button className="btn-primary" onClick={onClose}>{t('close') || 'Đóng'}</button>
          ) : isFinancialBlock && onGoToQuarantine ? (
            <>
              <button className="btn-outline" onClick={onClose} disabled={loading}>{t('close') || 'Đóng'}</button>
              <button className="btn-primary" onClick={onGoToQuarantine}>{t('goToQuarantine') || 'Đi tới Cô lập dữ liệu'}</button>
            </>
          ) : isBlocked ? (
            <button className="btn-outline" onClick={onClose} disabled={loading}>{t('close') || 'Đóng'}</button>
          ) : (
            <>
              <button className="btn-outline" onClick={onClose} disabled={loading}>{t('cancel')}</button>
              <button className="btn-danger" onClick={onConfirm} disabled={loading || isBlocked}>
                {loading ? (t('deleting') || 'Đang xóa...') : t('hardDelete')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
