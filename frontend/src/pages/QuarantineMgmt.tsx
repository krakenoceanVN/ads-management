import React, { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../AppContext';
import { Table } from '../components/Table';
import { listQuarantineBatches, restoreQuarantineBatch, type QuarantineResult } from '../lib/bffApi';

type QuarantineBatchRow = {
  id: string;
  scopeType: string;
  advertiserId: string | null;
  adSiteId: string | null;
  startDate: string;
  endDate: string;
  reason: string | null;
  recordCount: number;
  totalRevenue: string;
  createdAt: string;
  restoredAt: string | null;
  restoredBy: string | null;
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('zh', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(dateStr);
  }
}

function formatAmount(val: string | number | null | undefined): string {
  if (val == null) return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Request failed');
}

export function QuarantineMgmt() {
  const { t } = useAppContext();
  const [rows, setRows] = useState<QuarantineBatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState('');

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listQuarantineBatches() as unknown as QuarantineBatchRow[];
      setRows(data ?? []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  const handleRestoreClick = (row: QuarantineBatchRow) => {
    setConfirmRestoreId(row.id);
    setConfirmName(row.scopeType === 'advertiser' ? `Advertiser #${row.advertiserId}` : `Media #${row.adSiteId}`);
  };

  const handleRestoreConfirm = async () => {
    if (confirmRestoreId == null) return;
    setRestoringId(confirmRestoreId);
    setError('');
    try {
      await restoreQuarantineBatch(confirmRestoreId);
      setConfirmRestoreId(null);
      setConfirmName('');
      await loadBatches();
    } catch (err: any) {
      setError(err?.message || errorMessage(err));
    } finally {
      setRestoringId(null);
    }
  };

  const scopeLabel = (scope: string) =>
    scope === 'advertiser' ? t('advertiser') || 'Advertiser' : t('media') || 'Media';

  return (
    <>
      {confirmRestoreId != null && (
        <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) { setConfirmRestoreId(null); setConfirmName(''); } }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{t('restoreData') || 'Restore Data'}</span>
              <button className="modal-close" onClick={() => { setConfirmRestoreId(null); setConfirmName(''); }} disabled={!!restoringId}>x</button>
            </div>
            <div className="modal-body">
              <div className="quarantine-warning">
                <div className="quarantine-warning-icon">↩️</div>
                <div className="quarantine-warning-text">
                  {t('restoreConfirmMessage') || `Restore all records in this quarantine batch? Records will reappear in reports once confirmed.`}
                </div>
              </div>
              <div className="form-group">
                <label>{t('scope') || 'Scope'}</label>
                <div className="form-value">{scopeLabel(rows.find(r => r.id === confirmRestoreId)?.scopeType ?? '')}</div>
              </div>
              <div className="form-group">
                <label>{t('period') || 'Period'}</label>
                <div className="form-value">
                  {rows.find(r => r.id === confirmRestoreId)?.startDate} — {rows.find(r => r.id === confirmRestoreId)?.endDate}
                </div>
              </div>
              <div className="form-group">
                <label>{t('records') || 'Records'}</label>
                <div className="form-value">{rows.find(r => r.id === confirmRestoreId)?.recordCount ?? 0}</div>
              </div>
              {error && <div className="form-error">{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => { setConfirmRestoreId(null); setConfirmName(''); }} disabled={!!restoringId}>
                {t('cancel')}
              </button>
              <button className="btn-primary" onClick={handleRestoreConfirm} disabled={!!restoringId}>
                {restoringId ? (t('restoring') || 'Restoring...') : (t('restore') || 'Restore')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page active">
        <div className="page-header">
          <h1 className="page-title">{t('mQuarantineMgmt') || 'Quarantine Management'}</h1>
        </div>
        <div className="card">
          {error && <div className="form-error" style={{ margin: '8px 0' }}>{error}</div>}
          <Table
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'scopeType', label: t('scope') || 'Scope', render: (r: QuarantineBatchRow) => scopeLabel(r.scopeType) },
              { key: 'startDate', label: t('startDate') || 'Start Date', render: (r: QuarantineBatchRow) => r.startDate ? r.startDate.slice(0, 10) : '—' },
              { key: 'endDate', label: t('endDate') || 'End Date', render: (r: QuarantineBatchRow) => r.endDate ? r.endDate.slice(0, 10) : '—' },
              { key: 'recordCount', label: t('records') || 'Records' },
              { key: 'totalRevenue', label: t('revenue') || 'Revenue', render: (r: QuarantineBatchRow) => formatAmount(r.totalRevenue) },
              { key: 'reason', label: t('reason') || 'Reason', render: (r: QuarantineBatchRow) => r.reason ?? '—' },
              { key: 'createdAt', label: t('createdAt') || 'Created', render: (r: QuarantineBatchRow) => formatDate(r.createdAt) },
              { key: 'restoredAt', label: t('restoredAt') || 'Restored', render: (r: QuarantineBatchRow) => r.restoredAt ? formatDate(r.restoredAt) : '—' },
              {
                key: '__actions__',
                label: t('actions') || 'Actions',
                render: (r: QuarantineBatchRow) => r.restoredAt
                  ? <span style={{ color: 'var(--text-sub)' }}>{t('restored') || 'Restored'}</span>
                  : <button className="btn-primary btn-sm" onClick={() => handleRestoreClick(r)}>{t('restore') || 'Restore'}</button>,
              },
            ]}
            data={rows}
            emptyText={rows.length === 0 && !loading ? (t('noData') || '—') : undefined}
          />
        </div>
      </div>
    </>
  );
}