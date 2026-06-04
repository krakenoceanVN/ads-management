import React, { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../AppContext';
import { Table } from '../components/Table';
import { HardDeleteModal } from '../components/HardDeleteModal';
import { listAdTypes, createAdType, updateAdType, hardDeleteAdType } from '../lib/bffApi';
import type { AdType } from '../lib/bffTypes';
import type { HardDeleteResult } from '../lib/bffApi';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Request failed');
}

function isValidCode(code: string): boolean {
  return /^[A-Z0-9_]+$/.test(code);
}

interface EditState {
  id?: number;
  code: string;
  name: string;
}

export function AdTypeMgmt() {
  const { t, can } = useAppContext();
  const [rows, setRows] = useState<AdType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editModal, setEditModal] = useState<EditState | null>(null);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<AdType | null>(null);
  const [hardDeleteResult, setHardDeleteResult] = useState<HardDeleteResult | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = useState(false);
  const [hardDeleteError, setHardDeleteError] = useState('');

  const canWrite = can('role.update');
  const canHardDelete = can('masterData.hardDelete');

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listAdTypes();
      setRows(data ?? []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const openCreate = () => {
    setEditModal({ code: '', name: '' });
    setEditError('');
  };

  const openEdit = (row: AdType) => {
    setEditModal({ id: row.id, code: row.code, name: row.name });
    setEditError('');
  };

  const closeModal = () => {
    setEditModal(null);
    setEditError('');
  };

  const handleSave = async () => {
    if (!editModal) return;
    const { code, name } = editModal;

    if (!code.trim()) { setEditError(t('requiredFields')); return; }
    if (!name.trim()) { setEditError(t('requiredFields')); return; }
    if (!isValidCode(code.trim().toUpperCase())) {
      setEditError(t('requiredFields'));
      return;
    }

    setSaving(true);
    setEditError('');
    try {
      if (editModal.id !== undefined) {
        await updateAdType(editModal.id, { code: code.trim().toUpperCase(), name: name.trim() });
      } else {
        await createAdType({ code: code.trim().toUpperCase(), name: name.trim() });
      }
      setEditModal(null);
      await loadRows();
    } catch (err: any) {
      setEditError(err?.message || errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openHardDelete = (row: AdType) => {
    setHardDeleteTarget(row);
    setHardDeleteResult(null);
    setHardDeleteError('');
    setHardDeleteOpen(true);
  };

  const handleHardDeleteConfirm = async () => {
    if (!hardDeleteTarget) return;
    setHardDeleteLoading(true);
    setHardDeleteError('');
    try {
      const result = await hardDeleteAdType(hardDeleteTarget.id);
      setHardDeleteResult(result);
      if (result.success) {
        setRows(prev => prev.filter(r => r.id !== hardDeleteTarget.id));
      }
    } catch (err: any) {
      setHardDeleteError(err?.message || 'Unexpected error');
    } finally {
      setHardDeleteLoading(false);
    }
  };

  const handleHardDeleteClose = () => {
    if (hardDeleteLoading) return;
    setHardDeleteOpen(false);
    setHardDeleteResult(null);
    setHardDeleteError('');
  };

  return (
    <>
      {editModal && (
        <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                {editModal.id !== undefined ? t('editAdType') : t('newAdType')}
              </span>
              <button className="modal-close" onClick={closeModal} disabled={saving}>x</button>
            </div>
            <div className="modal-body">
              {editError && <div className="form-error" style={{ marginBottom: '8px' }}>{editError}</div>}
              <div className="form-group">
                <label>{t('adOrderCode')} <span style={{ color: 'red' }}>*</span></label>
                <input
                  className="input"
                  type="text"
                  value={editModal.code}
                  placeholder="e.g. GOOGLE"
                  maxLength={20}
                  style={{ textTransform: 'uppercase' }}
                  onChange={e => setEditModal(prev => prev ? { ...prev, code: e.target.value.toUpperCase() } : prev)}
                  disabled={saving || editModal.id !== undefined}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-sub)', marginTop: '4px' }}>
                  {t('type')}: A-Z, 0-9, _
                </div>
              </div>
              <div className="form-group">
                <label>{t('adOrderName')} <span style={{ color: 'red' }}>*</span></label>
                <input
                  className="input"
                  type="text"
                  value={editModal.name}
                  placeholder="e.g. Google Ads"
                  maxLength={50}
                  onChange={e => setEditModal(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={closeModal} disabled={saving}>{t('cancel')}</button>
              <button className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? '...' : t('saveSystem')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page active">
        <div className="page-header">
          <h1 className="page-title">{t('pAdOrderMgmt')}</h1>
          {canWrite && (
            <div className="toolbar-left">
              <button className="btn-primary" onClick={openCreate}>{t('newAdType')}</button>
            </div>
          )}
        </div>
        <div className="card">
          {error && <div className="form-error" style={{ margin: '8px 0' }}>{error}</div>}
          <Table
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'code', label: t('adOrderCode'), render: (r: AdType) => <code style={{ fontWeight: 600 }}>{r.code}</code> },
              { key: 'name', label: t('adOrderName') },
              { key: 'createdAt', label: t('createdAt'), render: (r: AdType) => new Date(r.createdAt).toLocaleDateString() },
              {
                key: '__actions__',
                label: t('actions'),
                render: (r: AdType) => (canWrite || canHardDelete) ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {canWrite && <button className="btn-outline btn-xs" onClick={() => openEdit(r)}>{t('edit')}</button>}
                    {canHardDelete && <button className="btn-outline btn-xs" style={{ color: 'var(--error)' }} onClick={() => openHardDelete(r)}>{t('hardDelete')}</button>}
                  </div>
                ) : <span style={{ color: 'var(--text-sub)', fontSize: '12px' }}>—</span>,
              },
            ]}
            data={rows}
            emptyText={rows.length === 0 && !loading ? (t('noData') || '—') : undefined}
          />
        </div>
      </div>
      <HardDeleteModal
        open={hardDeleteOpen}
        entityName={hardDeleteTarget?.code ?? ''}
        loading={hardDeleteLoading}
        error={hardDeleteError}
        result={hardDeleteResult}
        onConfirm={handleHardDeleteConfirm}
        onClose={handleHardDeleteClose}
      />
    </>
  );
}
