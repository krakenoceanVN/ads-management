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
  id?: number;
  adTypeIds: string[];
  downstreamType: string;
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
  const [contactSort, setContactSort] = useState<SortDirection>('asc');
  const [phoneSort, setPhoneSort] = useState<SortDirection>('asc');
  const [emailSort, setEmailSort] = useState<SortDirection>('asc');
  const [notesSort, setNotesSort] = useState<SortDirection>('asc');
  const [editing, setEditing] = useState<DownstreamDto | null>(null);

  const quarantine = useQuarantineAction({
    scope: 'advertiser',
    targetId: String(editing?.id ?? ''),
    targetName: editing?.downstreamType ?? '',
  });

  const toggleStatusSort = () => {
    setStatusSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };
  const toggleNameSort = () => {
    setNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };
  const toggleContactSort = () => setContactSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const togglePhoneSort = () => setPhoneSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleEmailSort = () => setEmailSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleNotesSort = () => setNotesSort(prev => (prev === 'asc' ? 'desc' : 'asc'));

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
    (id: string) => displayName(adTypes.find(a => a.id === id)?.name ?? id),
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
      const ids = getDownstreamAdTypeCodes(r);
      if (!ids.includes(filterAdType)) return false;
    }
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
    const aActive = a.status === 'active' ? 1 : 0;
    const bActive = b.status === 'active' ? 1 : 0;
    const statusDelta = aActive - bActive;
    const statusOrder = statusSort === 'asc' ? statusDelta : -statusDelta;
    if (statusOrder !== 0) return statusOrder;
    const nameA = a.name ?? a.downstreamType ?? '';
    const nameB = b.name ?? b.downstreamType ?? '';
    const nameDelta = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    const nameOrder = nameSort === 'asc' ? nameDelta : -nameDelta;
    if (nameOrder !== 0) return nameOrder;
    const contactA = a.contact ?? '';
    const contactB = b.contact ?? '';
    const contactDelta = contactA.localeCompare(contactB, undefined, { sensitivity: 'base' });
    const contactOrder = contactSort === 'asc' ? contactDelta : -contactDelta;
    if (contactOrder !== 0) return contactOrder;
    const phoneA = a.phone ?? '';
    const phoneB = b.phone ?? '';
    const phoneDelta = phoneA.localeCompare(phoneB, undefined, { sensitivity: 'base' });
    const phoneOrder = phoneSort === 'asc' ? phoneDelta : -phoneDelta;
    if (phoneOrder !== 0) return phoneOrder;
    const emailA = a.email ?? '';
    const emailB = b.email ?? '';
    const emailDelta = emailA.localeCompare(emailB, undefined, { sensitivity: 'base' });
    const emailOrder = emailSort === 'asc' ? emailDelta : -emailDelta;
    if (emailOrder !== 0) return emailOrder;
    const notesA = a.notes ?? '';
    const notesB = b.notes ?? '';
    const notesDelta = notesA.localeCompare(notesB, undefined, { sensitivity: 'base' });
    const notesOrder = notesSort === 'asc' ? notesDelta : -notesDelta;
    if (notesOrder !== 0) return notesOrder;
    return a.id - b.id;
  }), [rows, filterAdType, filterStatus, keyword, getAdTypeNames, statusSort, nameSort, contactSort, phoneSort, emailSort, notesSort, displayName]);

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
      downstreamType: '',
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
      downstreamType: row.downstreamType,
      name: row.name ?? '',
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

  const toggleAdType = (id: string) => {
    setEditModal(prev => {
      if (!prev) return prev;
      const exists = prev.adTypeIds.includes(id);
      return {
        ...prev,
        adTypeIds: exists
          ? prev.adTypeIds.filter(c => c !== id)
          : [...prev.adTypeIds, id],
      };
    });
  };

  const handleSave = async () => {
    if (!editModal) return;
    const { id, adTypeIds, downstreamType, name, contact, phone, email, notes, status } = editModal;

    if (!downstreamType.trim()) { setEditError(t('requiredFields')); return; }
    if (email.trim() && !isValidEmailForm(email)) {
      setEditError(t('invalidEmail') || 'Email không hợp lệ');
      return;
    }

    setSaving(true);
    setEditError('');
    try {
      const trimmed = (s: string) => s.trim() || null;
      const common = {
        downstreamType,
        name: trimmed(name),
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

  const removeRecord = (row?: DownstreamDto) => {
    const target = row ?? editing;
    if (!target) return;
    if (!window.confirm(t('confirmDelete'))) return;
    setEditing(target);
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
    { key: 'name', label: t('mediaName'), render: (r: DownstreamDto) => <code style={{ fontWeight: 600 }}>{r.name || r.downstreamType}</code>, sortDirection: nameSort, onSortClick: toggleNameSort },
    { key: 'contact', label: t('contact'), render: (r: DownstreamDto) => displayName(r.contact ?? '-'), sortDirection: contactSort, onSortClick: toggleContactSort },
    { key: 'phone', label: t('phone'), render: (r: DownstreamDto) => r.phone ?? '-', sortDirection: phoneSort, onSortClick: togglePhoneSort },
    { key: 'email', label: t('email'), render: (r: DownstreamDto) => r.email ?? '-', sortDirection: emailSort, onSortClick: toggleEmailSort },
    { key: 'notes', label: t('notes'), render: (r: DownstreamDto) => displayName(r.notes ?? '-'), sortDirection: notesSort, onSortClick: toggleNotesSort },
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
                <label>{t('mediaName')}</label>
                <input
                  className="input"
                  value={editModal.name}
                  disabled={saving}
                  onChange={e => setEditModal(prev => prev ? { ...prev, name: e.target.value } : prev)}
                />
              </div>
              <div className="form-group">
                <label>{t('adType')}</label>
                <div className="checkbox-list">
                  {adTypes.map(type => {
                    const checked = editModal.adTypeIds.includes(type.id);
                    return (
                      <label key={type.id} className="checkbox-list-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving}
                          onChange={() => toggleAdType(type.id)}
                        />
                        <span>{displayName(type.name)}</span>
                      </label>
                    );
                  })}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-sub)', marginTop: '4px' }}>
                  {t('adTypeOptionalHint') || 'Có thể bỏ trống'}
                </div>
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
                {adTypes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
              onDelete={canWrite ? removeRecord : undefined}
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