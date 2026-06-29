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
} from '../lib/bffApi';
import type { DownstreamDto, EntityStatus } from '../lib/bffTypes';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Request failed');
}

function isValidEmailForm(value: string) {
  const raw = value.trim();
  if (!raw) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

function getDownstreamAdTypeCodes(record: DownstreamDto): string[] {
  if (record.adTypeIds?.length) return record.adTypeIds;
  if (record.adTypeCode) return [record.adTypeCode];
  return [];
}

interface EditState {
  id?: string;
  adTypeIds: string[];
  name: string;
  contact: string;
  phone: string;
  email: string;
  notes: string;
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
  const [rows, setRows] = useState<DownstreamDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editModal, setEditModal] = useState<EditState | null>(null);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDownstream, setFilterDownstream] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortState, setSortState] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const toggleSort = (col: string) => {
    setSortState(prev => {
      if (prev?.col === col) return prev.dir === 'asc' ? { col, dir: 'desc' } : null;
      return { col, dir: 'asc' };
    });
  };
  const [editing, setEditing] = useState<DownstreamDto | null>(null);

  const quarantine = useQuarantineAction({
    scope: 'advertiser',
    targetId: String(editing?.id ?? ''),
    targetName: editing?.downstreamType ?? '',
  });

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const ds = await listDownstreams();
      setRows(ds ?? []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const keyword = normalizeText(search);
  const filteredRows = useMemo(() => rows.filter(r => {
    if (filterDownstream && String(r.id) !== filterDownstream) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    if (!keyword) return true;
    return [
      r.downstreamType,
      r.name,
      r.contact,
      r.phone,
      r.email,
      r.notes,
      getDownstreamAdTypeCodes(r).join(' '),
      r.status,
    ].some(value => normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword));
  }).sort((a, b) => {
    if (sortState) {
      let delta = 0;
      switch (sortState.col) {
        case 'name':
          delta = (a.name ?? a.downstreamType ?? '').localeCompare(b.name ?? b.downstreamType ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'contact':
          delta = (a.contact ?? '').localeCompare(b.contact ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'phone':
          delta = (a.phone ?? '').localeCompare(b.phone ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'email':
          delta = (a.email ?? '').localeCompare(b.email ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'notes':
          delta = (a.notes ?? '').localeCompare(b.notes ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'status':
          delta = (a.status === 'active' ? 1 : 0) - (b.status === 'active' ? 1 : 0);
          break;
      }
      if (delta !== 0) return sortState.dir === 'asc' ? delta : -delta;
    }
    return String(a.id).localeCompare(String(b.id));
  }), [rows, filterDownstream, filterStatus, keyword, sortState, displayName]);

  const downstreamColumns: CsvColumn<DownstreamDto>[] = [
    { label: t('downstreamType') + ' / ' + t('media'), value: r => r.downstreamType },
    { label: t('mediaName'), value: r => r.name ?? '' },
    { label: t('contact'), value: r => r.contact ?? '' },
    { label: t('phone'), value: r => r.phone ?? '' },
    { label: t('email'), value: r => r.email ?? '' },
    { label: t('notes'), value: r => r.notes ?? '' },
    { label: t('status'), value: r => r.status ?? '' },
  ];

  const openCreate = () => {
    setEditing(null);
    setEditModal({
      adTypeIds: [],
      name: '',
      contact: '',
      phone: '',
      email: '',
      notes: '',
      status: 'active',
    });
    setEditError('');
  };

  const openEdit = (row: DownstreamDto) => {
    setEditing(row);
    setEditModal({
      id: row.id,
      adTypeIds: getDownstreamAdTypeCodes(row),
      name: row.name || row.downstreamType,
      contact: row.contact ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      notes: row.notes ?? '',
      status: row.status,
    });
    setEditError('');
  };

  const closeModal = () => {
    setEditModal(null);
    setEditError('');
    setEditing(null);
  };

  const handleSave = async () => {
    if (!editModal) return;
    const { id, adTypeIds, name, contact, phone, email, notes, status } = editModal;

    const trimmedName = name.trim();
    if (!trimmedName) { setEditError(t('requiredFields')); return; }
    if (email.trim() && !isValidEmailForm(email)) {
      setEditError(t('invalidEmail') || 'Email không hợp lệ');
      return;
    }

    setSaving(true);
    setEditError('');
    try {
      const trimmed = (s: string) => s.trim() || null;
      const common = {
        downstreamType: trimmedName,
        name: trimmedName,
        contact: trimmed(contact),
        phone: trimmed(phone),
        email: trimmed(email),
        notes: trimmed(notes),
        status,
        adTypeIds,
      };
      if (id !== undefined) {
        await updateDownstream(id, common);
      } else {
        await createDownstream(common);
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

  const columns: Column<DownstreamDto>[] = [
    { key: '__no__', label: t('no') },
    { key: 'name', label: t('mediaName'), render: (r: DownstreamDto) => <code style={{ fontWeight: 600 }}>{r.name || r.downstreamType}</code>, sortDirection: sortState?.col === 'name' ? sortState.dir : null, onSortClick: () => toggleSort('name') },
    { key: 'contact', label: t('contact'), render: (r: DownstreamDto) => displayName(r.contact ?? '-'), sortDirection: sortState?.col === 'contact' ? sortState.dir : null, onSortClick: () => toggleSort('contact') },
    { key: 'phone', label: t('phone'), render: (r: DownstreamDto) => r.phone ?? '-', sortDirection: sortState?.col === 'phone' ? sortState.dir : null, onSortClick: () => toggleSort('phone') },
    { key: 'email', label: t('email'), render: (r: DownstreamDto) => r.email ?? '-', sortDirection: sortState?.col === 'email' ? sortState.dir : null, onSortClick: () => toggleSort('email') },
    { key: 'notes', label: t('notes'), render: (r: DownstreamDto) => displayName(r.notes ?? '-'), sortDirection: sortState?.col === 'notes' ? sortState.dir : null, onSortClick: () => toggleSort('notes') },
    {
      key: 'status',
      label: t('status'),
      render: (r: DownstreamDto) => <StatusToggle status={r.status === 'active'} onChange={active => updateStatus(r, active)} />,
      sortDirection: sortState?.col === 'status' ? sortState.dir : null,
      onSortClick: () => toggleSort('status'),
    },
    {
      key: '__actions__',
      label: t('actions'),
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
                <label>{t('downstreamName')} <span style={{ color: 'red' }}>*</span></label>
                <input
                  className="input"
                  value={editModal.name}
                  maxLength={100}
                  disabled={saving}
                  onChange={e => setEditModal(prev => prev ? { ...prev, name: e.target.value } : prev)}
                />
              </div>
              <div className="form-group">
                <label>{t('contact')}</label>
                <input
                  className="input"
                  value={editModal.contact}
                  disabled={saving}
                  onChange={e => setEditModal(prev => prev ? { ...prev, contact: e.target.value } : prev)}
                />
              </div>
              <div className="form-group">
                <label>{t('phone')}</label>
                <input
                  className="input"
                  value={editModal.phone}
                  disabled={saving}
                  onChange={e => setEditModal(prev => prev ? { ...prev, phone: e.target.value } : prev)}
                />
              </div>
              <div className="form-group">
                <label>{t('email')}</label>
                <input
                  className="input"
                  type="email"
                  value={editModal.email}
                  disabled={saving}
                  onChange={e => setEditModal(prev => prev ? { ...prev, email: e.target.value } : prev)}
                />
              </div>
              <div className="form-group">
                <label>{t('notes')}</label>
                <input
                  className="input"
                  value={editModal.notes}
                  disabled={saving}
                  onChange={e => setEditModal(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                />
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
              {editing && (
                <button className="btn-danger" onClick={removeRecord} disabled={saving}>{t('delete')}</button>
              )}
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
              <select className="filter-select" value={filterDownstream} onChange={e => setFilterDownstream(e.target.value)}>
                <option value="">{t('selectDownstream')}</option>
                {rows.map(d => <option key={d.id} value={String(d.id)}>{displayName(d.name || d.downstreamType)}</option>)}
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
              onEdit={canWrite ? openEdit : undefined}
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