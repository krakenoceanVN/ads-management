import React, { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../AppContext';
import { Table } from '../components/Table';
import { listDownstreams, createDownstream, updateDownstream, deleteDownstream, listAdTypes } from '../lib/bffApi';
import type { AdType, DownstreamDto, EntityStatus } from '../lib/bffTypes';

const DOWNSTREAM_TYPES = ['ML', 'LE', 'YIYI'];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Request failed');
}

function getDownstreamAdTypeCodes(record: DownstreamDto): string[] {
  if (record.adTypeCodes?.length) return record.adTypeCodes;
  if (record.adTypeCode) return [record.adTypeCode];
  return [];
}

interface EditState {
  id?: number;
  adTypeCodes: string[];
  downstreamType: string;
  payoutPercent: string;
  status: EntityStatus;
}

export function DownstreamMgmt() {
  const { t, displayName, can } = useAppContext();
  const [rows, setRows] = useState<DownstreamDto[]>([]);
  const [adTypes, setAdTypes] = useState<AdType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editModal, setEditModal] = useState<EditState | null>(null);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterAdType, setFilterAdType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DownstreamDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const canWrite = can('media.update');

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ds, ats] = await Promise.all([listDownstreams(), listAdTypes()]);
      setRows(ds ?? []);
      setAdTypes(ats ?? []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const adTypeName = useCallback(
    (code: string) => displayName(adTypes.find(a => a.code === code)?.name ?? code),
    [adTypes, displayName],
  );

  const getAdTypeNames = useCallback(
    (record: DownstreamDto) => {
      const codes = getDownstreamAdTypeCodes(record);
      return codes.map(code => adTypeName(code)).join(', ');
    },
    [adTypeName],
  );

  const filteredRows = rows.filter(r => {
    if (filterAdType) {
      const codes = getDownstreamAdTypeCodes(r);
      if (!codes.includes(filterAdType)) return false;
    }
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setActionMsg('');
    try {
      const result = await deleteDownstream(deleteTarget.id);
      setActionMsg(result.mode === 'deleted' ? t('downstreamDeleted') : t('downstreamDeactivated'));
      setDeleteTarget(null);
      await loadRows();
    } catch (err: any) {
      setActionMsg(err?.message || errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const openCreate = () => {
    setEditModal({ adTypeCodes: [], downstreamType: '', payoutPercent: '80', status: 'active' });
    setEditError('');
  };

  const openEdit = (row: DownstreamDto) => {
    setEditModal({
      id: row.id,
      adTypeCodes: getDownstreamAdTypeCodes(row),
      downstreamType: row.downstreamType,
      payoutPercent: String(Math.round((row.payoutRate ?? 0) * 1000) / 10),
      status: row.status,
    });
    setEditError('');
  };

  const closeModal = () => {
    setEditModal(null);
    setEditError('');
  };

  const toggleAdType = (code: string) => {
    setEditModal(prev => {
      if (!prev) return prev;
      const exists = prev.adTypeCodes.includes(code);
      return {
        ...prev,
        adTypeCodes: exists
          ? prev.adTypeCodes.filter(c => c !== code)
          : [...prev.adTypeCodes, code],
      };
    });
  };

  const handleSave = async () => {
    if (!editModal) return;
    const { id, adTypeCodes, downstreamType, payoutPercent, status } = editModal;

    if (id === undefined && adTypeCodes.length === 0) { setEditError(t('requiredFields')); return; }
    if (!downstreamType.trim()) { setEditError(t('requiredFields')); return; }
    const percent = Number(payoutPercent);
    if (Number.isNaN(percent) || percent < 0 || percent > 10000) {
      setEditError(t('payoutRateRange'));
      return;
    }
    const payoutRate = Math.round((percent / 100) * 10000) / 10000;

    setSaving(true);
    setEditError('');
    try {
      if (id !== undefined) {
        await updateDownstream(id, { downstreamType, payoutRate, status, adTypeCodes });
      } else {
        await createDownstream({ adTypeCodes, downstreamType, payoutRate, status });
      }
      setEditModal(null);
      await loadRows();
    } catch (err: any) {
      setEditError(err?.message || errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {editModal && (
        <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                {editModal.id !== undefined ? t('editDownstream') : t('newDownstream')}
              </span>
              <button className="modal-close" onClick={closeModal} disabled={saving}>x</button>
            </div>
            <div className="modal-body">
              {editError && <div className="form-error" style={{ marginBottom: '8px' }}>{editError}</div>}
              <div className="form-group">
                <label>{t('adType')} <span style={{ color: 'red' }}>*</span></label>
                <div className="checkbox-list">
                  {adTypes.map(type => {
                    const checked = editModal.adTypeCodes.includes(type.code);
                    return (
                      <label key={type.code} className="checkbox-list-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving}
                          onChange={() => toggleAdType(type.code)}
                        />
                        <span>{displayName(type.name)} ({type.code})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label>{t('downstreamType')} <span style={{ color: 'red' }}>*</span></label>
                <input
                  className="input"
                  list="downstream-type-suggestions"
                  value={editModal.downstreamType}
                  placeholder="ML / LE / YIYI / ..."
                  maxLength={20}
                  style={{ textTransform: 'uppercase' }}
                  disabled={saving}
                  onChange={e => setEditModal(prev => prev ? { ...prev, downstreamType: e.target.value.toUpperCase() } : prev)}
                />
                <datalist id="downstream-type-suggestions">
                  {DOWNSTREAM_TYPES.map(type => <option key={type} value={type} />)}
                </datalist>
                <div style={{ fontSize: '11px', color: 'var(--text-sub)', marginTop: '4px' }}>
                  {t('downstreamTypeHint')}
                </div>
              </div>
              <div className="form-group">
                <label>{t('payoutRate')} (%) <span style={{ color: 'red' }}>*</span></label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={10000}
                  step={0.1}
                  value={editModal.payoutPercent}
                  onChange={e => setEditModal(prev => prev ? { ...prev, payoutPercent: e.target.value } : prev)}
                  disabled={saving}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-sub)', marginTop: '4px' }}>
                  {t('payoutRateHint')}
                </div>
              </div>
              <div className="form-group">
                <label>{t('status')}</label>
                <select
                  value={editModal.status}
                  disabled={saving}
                  onChange={e => setEditModal(prev => prev ? { ...prev, status: e.target.value as EntityStatus } : prev)}
                >
                  <option value="active">{t('active')}</option>
                  <option value="inactive">{t('inactive')}</option>
                </select>
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

      {deleteTarget && (
        <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget && !deleteBusy) setDeleteTarget(null); }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{t('confirmRemoveDownstream')}</span>
              <button className="modal-close" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>x</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '8px' }}>
                <code style={{ fontWeight: 600 }}>{deleteTarget.downstreamType}</code> ({getAdTypeNames(deleteTarget)})
              </p>
              <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>{t('removeDownstreamHint')}</div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>{t('cancel')}</button>
              <button className="btn-primary" style={{ background: 'var(--error)' }} onClick={() => void confirmDelete()} disabled={deleteBusy}>
                {deleteBusy ? '...' : t('removeDownstream')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page active">
        <div className="page-header">
          <h1 className="page-title">{t('pDownstreamMgmt')}</h1>
          {canWrite && (
            <div className="toolbar-left">
              <button className="btn-primary" onClick={openCreate}>{t('newDownstream')}</button>
            </div>
          )}
        </div>
        <div className="card">
          {error && <div className="form-error" style={{ margin: '8px 0' }}>{error}</div>}
          {actionMsg && <div className="form-info" style={{ margin: '8px 0', color: 'var(--text-sub)' }}>{actionMsg}</div>}
          <div className="toolbar" style={{ marginBottom: '8px' }}>
            <div className="toolbar-right" style={{ display: 'flex', gap: '8px' }}>
              <select className="filter-select" value={filterAdType} onChange={e => setFilterAdType(e.target.value)}>
                <option value="">{t('allAdTypes')}</option>
                {adTypes.map(a => <option key={a.id} value={a.code}>{a.name} ({a.code})</option>)}
              </select>
              <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">{t('allStatuses')}</option>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
            </div>
          </div>
          <Table
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'downstreamType', label: t('downstreamType'), render: (r: DownstreamDto) => <code style={{ fontWeight: 600 }}>{r.downstreamType}</code> },
              { key: 'adTypeCodes', label: t('adType'), render: (r: DownstreamDto) => getAdTypeNames(r) },
              { key: 'payoutRate', label: t('payoutRate'), render: (r: DownstreamDto) => `${Math.round((r.payoutRate ?? 0) * 1000) / 10}%` },
              { key: 'status', label: t('status'), render: (r: DownstreamDto) => r.status === 'active' ? t('active') : t('inactive') },
              {
                key: '__actions__',
                label: t('actions'),
                render: (r: DownstreamDto) => canWrite ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-outline btn-xs" onClick={() => openEdit(r)}>{t('edit')}</button>
                    <button className="btn-outline btn-xs" style={{ color: 'var(--error)' }} onClick={() => { setActionMsg(''); setDeleteTarget(r); }}>{t('removeDownstream')}</button>
                  </div>
                ) : <span style={{ color: 'var(--text-sub)', fontSize: '12px' }}>—</span>,
              },
            ]}
            data={filteredRows}
            emptyText={filteredRows.length === 0 && !loading ? (t('noData') || '—') : undefined}
          />
        </div>
      </div>
    </>
  );
}
