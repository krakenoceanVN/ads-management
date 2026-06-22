import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import { Table, type Column, type SortDirection } from '../components/Table';
import { StatusToggle } from './Advertiser';
import { QuarantineConfirmModal } from '../components/QuarantineConfirmModal';
import { useQuarantineAction } from '../hooks/useQuarantineAction';
import {
  listDownstreams,
  createDownstream,
  updateDownstream,
  deleteDownstream,
  listAdTypes,
} from '../lib/bffApi';
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

type CsvColumn<T> = {
  label: string;
  value: (row: T) => string | number;
};

function csvEscape(value: string | number) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]) {
  const header = columns.map(c => csvEscape(c.label)).join(',');
  const body = rows.map(row => columns.map(c => csvEscape(c.value(row))).join(',')).join('\n');
  const blob = new Blob([`﻿${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function normalizeText(value: unknown) {
  return String(value ?? '').toLowerCase();
}

function LoadingState({ t }: { t: (key: string) => string }) {
  return <div className="empty-state"><div className="empty-state-text">{t('loading')}</div></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-state-text">{message}</div>
      <button className="btn-outline" type="button" onClick={onRetry}>Retry</button>
    </div>
  );
}

export function DownstreamMgmt() {
  const { t, displayName, can } = useAppContext();
  const canWrite = can('media.update');
  const canHardDelete = can('masterData.hardDelete');
  const [rows, setRows] = useState<DownstreamDto[]>([]);
  const [adTypes, setAdTypes] = useState<AdType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editModal, setEditModal] = useState<EditState | null>(null);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterAdType, setFilterAdType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [statusSort, setStatusSort] = useState<SortDirection>('asc');
  const [nameSort, setNameSort] = useState<SortDirection>('asc');
  const [editing, setEditing] = useState<DownstreamDto | null>(null);

  const quarantine = useQuarantineAction({
    scope: 'advertiser',
    targetId: editing?.id ?? 0,
    targetName: editing?.downstreamType ?? '',
  });

  const toggleStatusSort = () => {
    setStatusSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };
  const toggleNameSort = () => {
    setNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

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

  const keyword = normalizeText(search);
  const filteredRows = useMemo(() => rows.filter(r => {
    if (filterAdType) {
      const codes = getDownstreamAdTypeCodes(r);
      if (!codes.includes(filterAdType)) return false;
    }
    if (filterStatus && r.status !== filterStatus) return false;
    if (!keyword) return true;
    return [
      r.downstreamType,
      getAdTypeNames(r),
      getDownstreamAdTypeCodes(r).join(' '),
      String(Math.round((r.payoutRate ?? 0) * 1000) / 10),
      r.status,
    ].some(value => normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword));
  }).sort((a, b) => {
    const aActive = a.status === 'active' ? 1 : 0;
    const bActive = b.status === 'active' ? 1 : 0;
    const statusDelta = aActive - bActive;
    const statusOrder = statusSort === 'asc' ? statusDelta : -statusDelta;
    if (statusOrder !== 0) return statusOrder;
    const nameA = a.downstreamType ?? '';
    const nameB = b.downstreamType ?? '';
    const nameDelta = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    const nameOrder = nameSort === 'asc' ? nameDelta : -nameDelta;
    if (nameOrder !== 0) return nameOrder;
    return a.id - b.id;
  }), [rows, filterAdType, filterStatus, keyword, getAdTypeNames, statusSort, nameSort, displayName]);

  const downstreamColumns: CsvColumn<DownstreamDto>[] = [
    { label: 'ID', value: r => r.id },
    { label: t('downstreamType'), value: r => r.downstreamType },
    { label: t('adType'), value: r => getAdTypeNames(r) },
    { label: t('payoutRate'), value: r => `${Math.round((r.payoutRate ?? 0) * 1000) / 10}%` },
    { label: t('status'), value: r => r.status ?? '' },
  ];

  const openCreate = () => {
    setEditing(null);
    setEditModal({ adTypeCodes: [], downstreamType: '', payoutPercent: '80', status: 'active' });
    setEditError('');
  };

  const openEdit = (row: DownstreamDto) => {
    setEditing(row);
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
    setEditing(null);
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
      setEditing(null);
      await loadRows();
    } catch (err: any) {
      setEditError(err?.message || errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = () => {
    if (!editing) return;
    if (!window.confirm(t('confirmDelete'))) return;
    quarantine.openModal();
  };

  const updateStatus = async (record: DownstreamDto, active: boolean) => {
    const nextStatus: EntityStatus = active ? 'active' : 'inactive';
    try {
      await updateDownstream(record.id, { status: nextStatus });
      await loadRows();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const openHardDelete = () => {
    // No backend route for hardDeleteDownstream — keep stub for parity.
  };

  const columns: Column<DownstreamDto>[] = [
    { key: '__no__', label: t('no') },
    { key: 'id', label: 'ID' },
    { key: 'downstreamType', label: t('downstreamType'), render: (r: DownstreamDto) => <code style={{ fontWeight: 600 }}>{r.downstreamType}</code>, sortDirection: nameSort, onSortClick: toggleNameSort },
    { key: 'adTypeCodes', label: t('adType'), render: (r: DownstreamDto) => getAdTypeNames(r) },
    { key: 'payoutRate', label: t('payoutRate'), render: (r: DownstreamDto) => `${Math.round((r.payoutRate ?? 0) * 1000) / 10}%` },
    {
      key: 'status',
      label: t('status'),
      render: (r: DownstreamDto) => <StatusToggle status={r.status === 'active'} onChange={active => updateStatus(r, active)} />,
      sortDirection: statusSort,
      onSortClick: toggleStatusSort,
    },
    {
      key: '__actions__',
      label: t('actions'),
      render: (r: DownstreamDto) => canWrite ? (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="btn-outline btn-xs" onClick={() => openEdit(r)}>{t('edit')}</button>
        </div>
      ) : <span style={{ color: 'var(--text-sub)', fontSize: '12px' }}>—</span>,
    },
  ];

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
              {editing && <button className="btn-danger" onClick={removeRecord} disabled={saving}>{t('delete')}</button>}
              <button className="btn-outline" onClick={closeModal} disabled={saving}>{t('cancel')}</button>
              <button className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? '...' : t('submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page active">
        <div className="page-header">
          <h1 className="page-title">{t('pDownstreamMgmt')}</h1>
        </div>
        <div className="card">
          <div className="toolbar">
            <div className="toolbar-left">
              {canWrite && (
                <button className="btn-primary" onClick={openCreate}>{t('newDownstream')}</button>
              )}
            </div>
            <div className="toolbar-right">
              <select className="filter-select" value={filterAdType} onChange={e => setFilterAdType(e.target.value)}>
                <option value="">{t('allAdTypes')}</option>
                {adTypes.map(a => <option key={a.id} value={a.code}>{a.name} ({a.code})</option>)}
              </select>
              <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">{t('allStatuses')}</option>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
              <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
              <button className="btn-outline" onClick={() => downloadCsv('downstreams.csv', downstreamColumns, filteredRows)}>{t('export')}</button>
            </div>
          </div>
          {loading ? <LoadingState t={t} /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
            <Table
              columns={columns}
              data={filteredRows}
              emptyText={filteredRows.length === 0 && !loading ? (t('noData') || '—') : undefined}
            />
          )}
        </div>
      </div>
      <QuarantineConfirmModal
        open={quarantine.open}
        scope="advertiser"
        targetName={editing?.downstreamType ?? quarantine.targetName}
        loading={quarantine.loading}
        error={quarantine.error}
        result={quarantine.result}
        onConfirm={quarantine.confirm}
        onClose={quarantine.closeModal}
      />
    </>
  );
}