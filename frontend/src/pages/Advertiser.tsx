import React from 'react';
import { useAppContext } from '../AppContext';
import { Table, TypeTag, type SortDirection } from '../components/Table';
import { QuarantineConfirmModal } from '../components/QuarantineConfirmModal';
import { HardDeleteModal } from '../components/HardDeleteModal';
import { useQuarantineAction } from '../hooks/useQuarantineAction';
import {
  createAdvertiser,
  listAdIds,
  listAdvertisers,
  listAdTypes,
  updateAdvertiser,
  createAdId,
  updateAdId,
  deleteAdId,
  hardDeleteAdvertiser,
  hardDeleteAdId,
  getAdvertiserDependencies,
  getAdIdDependencies,
  type HardDeleteResult,
} from '../lib/bffApi';
import type {
  AdId,
  Advertiser,
  AdType,
  CreateAdvertiserInput,
  EntityStatus,
  UpdateAdvertiserInput,
  CreateAdIdInput,
  UpdateAdIdInput,
} from '../lib/bffTypes';

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
  const header = columns.map(column => csvEscape(column.label)).join(',');
  const body = rows.map(row => columns.map(column => csvEscape(column.value(row))).join(',')).join('\n');
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

export function StatusToggle({ status, onChange, disabled }: { status?: boolean; onChange?: (nextStatus: boolean) => void; disabled?: boolean }) {
  const active = status !== false;
  return (
    <div
      onClick={() => !disabled && onChange?.(!active)}
      style={{ width: '34px', height: '20px', borderRadius: '10px', background: active ? '#4ade80' : '#cbd5e1', position: 'relative', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.65 : 1 }}
    >
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: active ? '16px' : '2px', transition: 'all 0.2s' }}></div>
    </div>
  );
}

function normalizeText(value: unknown) {
  return String(value ?? '').toLowerCase();
}

function formatBillingMethodLabel(type: string) {
  return type;
}

function formatMgmtRate(type: string, rate: unknown) {
  if (rate == null || rate === '') return '';
  const num = Number(rate);
  if (Number.isNaN(num)) return String(rate);
  if (type === 'CPS') {
    return `${(num * 100).toFixed(1)}%`;
  }
  return String(rate);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    // BffApiError carries server JSON error or statusText
    if (error.name === 'BffApiError') return error.message;
    // Network errors (server down, CORS, etc.)
    if (error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('Failed to fetch') || error.message.toLowerCase().includes('net::')) {
      return 'Không thể kết nối máy chủ.';
    }
    return error.message;
  }
  return String(error || 'Request failed');
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

type AdvertiserFormState = {
  name: string;
  adTypeIds: string[];
  status: EntityStatus;
  contact: string;
  phone: string;
  email: string;
  notes: string;
};

function getAdvertiserAdTypeIds(record: Advertiser): string[] {
  return record.adTypes?.length
    ? record.adTypes.map(at => String(at.id))
    : record.adTypeCodes?.length
      ? record.adTypeCodes
      : record.adTypeCode
        ? [record.adTypeCode]
        : [];
}

function getAdvertiserAdTypeNameList(record: Advertiser, mapById: Map<string, string>): string[] {
  if (record.adTypes?.length) {
    return record.adTypes.map(at => at.name);
  }
  return getAdvertiserAdTypeIds(record).map(id => mapById.get(id) ?? id);
}

function getAdvertiserAdTypeNames(record: Advertiser, map: Map<string, string>): string {
  return getAdvertiserAdTypeNameList(record, map).join(', ');
}

function defaultAdvertiserForm(adTypeId = ''): AdvertiserFormState {
  return { name: '', adTypeIds: adTypeId ? [adTypeId] : [], status: 'active', contact: '', phone: '', email: '', notes: '' };
}

function advertiserFormFromRecord(record: Advertiser, fallbackAdTypeId = ''): AdvertiserFormState {
  const adTypeIds = getAdvertiserAdTypeIds(record);
  return {
    name: record.name ?? '',
    adTypeIds: adTypeIds.length ? adTypeIds : fallbackAdTypeId ? [fallbackAdTypeId] : [],
    status: record.status ?? 'active',
    contact: record.contact ?? '',
    phone: record.phone ?? '',
    email: record.email ?? '',
    notes: record.notes ?? '',
  };
}

export function AdvertiserList() {
  const [search, setSearch] = React.useState('');
  const [adTypeFilter, setAdTypeFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [rows, setRows] = React.useState<Advertiser[]>([]);
  const [adTypes, setAdTypes] = React.useState<AdType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState<Advertiser | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<AdvertiserFormState>(defaultAdvertiserForm());
  const [formError, setFormError] = React.useState('');
  const { t, displayName, can } = useAppContext();
  const canHardDelete = can('masterData.hardDelete');

  const quarantine = useQuarantineAction({
    scope: 'advertiser',
    targetId: String(editing?.id ?? ''),
    targetName: editing?.name ?? '',
  });

  const [hardDeleteOpen, setHardDeleteOpen] = React.useState(false);
  const [hardDeleteResult, setHardDeleteResult] = React.useState<HardDeleteResult | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = React.useState(false);
  const [hardDeleteError, setHardDeleteError] = React.useState('');
  const [hasDeps, setHasDeps] = React.useState<boolean | null>(null);

  const openHardDelete = () => {
    setHardDeleteResult(null);
    setHardDeleteError('');
    setHardDeleteOpen(true);
  };

  const handleHardDeleteConfirm = async () => {
    if (!editing) return;
    setHardDeleteLoading(true);
    setHardDeleteError('');
    try {
      const result = await hardDeleteAdvertiser(editing.id);
      setHardDeleteResult(result);
      if (result.success) {
        setRows(prev => prev.filter(r => r.id !== editing.id));
        setFormOpen(false);
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

  const handleHardDeleteGoToQuarantine = () => {
    setHardDeleteOpen(false);
    setHardDeleteResult(null);
    quarantine.openModal();
  };

  const [sortState, setSortState] = React.useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const toggleSort = (col: string) => {
    setSortState(prev => {
      if (prev?.col === col) return prev.dir === 'asc' ? { col, dir: 'desc' } : null;
      return { col, dir: 'asc' };
    });
  };

  const advertiserColumns: CsvColumn<Advertiser>[] = [
    { label: t('advertiser'), value: r => displayName(r.name) },
    { label: t('adType'), value: r => getAdvertiserAdTypeNames(r, adTypeNameById) },
    { label: t('contact'), value: r => r.contact ?? '-' },
    { label: t('phone'), value: r => r.phone ?? '-' },
    { label: t('email'), value: r => r.email ?? '-' },
    { label: t('notes'), value: r => r.notes ?? '-' },
    { label: t('status'), value: r => r.status ?? '' },
  ];

  const adTypeNameById = React.useMemo(
    () => new Map(adTypes.map(at => [String(at.id), at.name])),
    [adTypes]
  );

  const adTypeOptions = React.useMemo(
    () => Array.from(new Map(adTypes.map(at => [at.name, { id: String(at.id), name: at.name }])).values()),
    [adTypes]
  );

  // Load AdTypes for the dropdown (all AdTypes, no filtering needed)
  const loadAdTypes = React.useCallback(async () => {
    try {
      const types: AdType[] = await listAdTypes();
      setAdTypes(types);
    } catch (err) {
      // Non-critical: keep existing on failure
    }
  }, []);

  // When advFilter changes — reload adTypes
  React.useEffect(() => {
    void loadAdTypes();
  }, [loadAdTypes]);

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [advertisers, types] = await Promise.all([listAdvertisers(), listAdTypes()]);
      setRows(advertisers as Advertiser[]);
      setAdTypes(types as AdType[]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const firstAdTypeId = adTypeOptions[0]?.id ?? '';
  const keyword = normalizeText(search);
  const visibleRows = rows.filter(row => {
    if (statusFilter && row.status !== statusFilter) return false;
    if (adTypeFilter && !getAdvertiserAdTypeIds(row).includes(adTypeFilter)) return false;
    if (!keyword) return true;
    return [
      row.name,
      getAdvertiserAdTypeNames(row, adTypeNameById),
      getAdvertiserAdTypeIds(row).join(' '),
      row.contact,
      row.phone,
      row.email,
      row.notes,
      row.status,
    ].some(value =>
      normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword)
    );
  }).sort((a, b) => {
    if (sortState) {
      let delta = 0;
      switch (sortState.col) {
        case 'name':
          delta = displayName(a.name).localeCompare(displayName(b.name), undefined, { sensitivity: 'base' });
          break;
        case 'adTypeCode':
          delta = getAdvertiserAdTypeNames(a, adTypeNameById).localeCompare(getAdvertiserAdTypeNames(b, adTypeNameById), undefined, { sensitivity: 'base' });
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
  });

  const openCreate = () => {
    setEditing(null);
    setForm(defaultAdvertiserForm(firstAdTypeId));
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (record: Advertiser) => {
    setEditing(record);
    setForm(advertiserFormFromRecord(record, firstAdTypeId));
    setFormError('');
    setFormOpen(true);
    setHasDeps(null);
    getAdvertiserDependencies(String(record.id))
      .then((deps: any) => {
        const total = Object.values(deps as Record<string, number>).reduce((s: number, v: number) => s + v, 0);
        setHasDeps(total > 0);
      })
      .catch(() => setHasDeps(false));
  };

  const submitForm = async () => {
    const emailValue = form.email.trim();
    const contactValue = form.contact.trim();
    const phoneValue = form.phone.trim();
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setFormError(t('invalidEmail') || 'Invalid email format');
      return;
    }
    if (!editing) {
      if (!contactValue || !phoneValue || !emailValue) {
        setFormError(t('requiredFields'));
        return;
      }
    }
    const payload: CreateAdvertiserInput | UpdateAdvertiserInput = {
      name: form.name.trim(),
      adTypeIds: form.adTypeIds,
      status: form.status,
      contact: contactValue || null,
      phone: phoneValue || null,
      email: emailValue || null,
      notes: form.notes.trim() || null,
    };
    if (!payload.name) {
      setFormError(t('requiredFields'));
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        const updated = await updateAdvertiser(editing.id, payload);
        setRows(prev => prev.map(row => row.id === updated.id ? updated : row));
      } else {
        const created = await createAdvertiser(payload as CreateAdvertiserInput);
        setRows(prev => [...prev, created]);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async () => {
    if (!editing) return;
    if (!window.confirm(t('confirmDelete'))) return;
    if (canHardDelete && hasDeps === false) {
      setSaving(true);
      setFormError('');
      try {
        const result = await hardDeleteAdvertiser(editing.id);
        if (result.success) {
          setRows(prev => prev.filter(r => r.id !== editing.id));
          setFormOpen(false);
        } else {
          setFormError(result.message || 'Unexpected error');
        }
      } catch (err) {
        setFormError(errorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }
    quarantine.openModal();
  };

  const updateStatus = async (record: Advertiser, active: boolean) => {
    const nextStatus: EntityStatus = active ? 'active' : 'inactive';
    try {
      const updated = await updateAdvertiser(record.id, { status: nextStatus });
      setRows(prev => prev.map(row => row.id === updated.id ? updated : row));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pAdvertiserList')}</h1></div>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left"><button className="btn-primary" onClick={openCreate}>{t('newAdvertiser')}</button></div>
          <div className="toolbar-right">
            <select className="filter-select" value={adTypeFilter} onChange={e => setAdTypeFilter(e.target.value)}>
              <option value="">{t('selectAdOrder')}</option>
              {adTypeOptions.map(type => <option key={type.id} value={type.id}>{displayName(type.name)}</option>)}
            </select>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">{t('allStatuses')}</option>
              <option value="active">{t('online')}</option>
              <option value="inactive">{t('offline')}</option>
            </select>
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-outline" onClick={() => downloadCsv('advertisers.csv', advertiserColumns, visibleRows)}>{t('export')}</button>
          </div>
        </div>
        {loading ? <LoadingState t={t} /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'name', label: t('advertiser'), render: r => displayName(r.name), sortDirection: sortState?.col === 'name' ? sortState.dir : null, onSortClick: () => toggleSort('name') },
              { key: 'adTypeCode', label: t('adType'), render: r => getAdvertiserAdTypeNames(r, adTypeNameById), sortDirection: sortState?.col === 'adTypeCode' ? sortState.dir : null, onSortClick: () => toggleSort('adTypeCode') },
              { key: 'contact', label: t('contact'), render: r => displayName(r.contact ?? '-'), sortDirection: sortState?.col === 'contact' ? sortState.dir : null, onSortClick: () => toggleSort('contact') },
              { key: 'phone', label: t('phone'), render: r => r.phone ?? '-', sortDirection: sortState?.col === 'phone' ? sortState.dir : null, onSortClick: () => toggleSort('phone') },
              { key: 'email', label: t('email'), render: r => r.email ?? '-', sortDirection: sortState?.col === 'email' ? sortState.dir : null, onSortClick: () => toggleSort('email') },
              { key: 'notes', label: t('notes'), render: r => displayName(r.notes ?? '-'), sortDirection: sortState?.col === 'notes' ? sortState.dir : null, onSortClick: () => toggleSort('notes') },
              { key: 'status', label: t('status'), render: r => <StatusToggle status={r.status === 'active'} onChange={status => updateStatus(r, status)} />, sortDirection: sortState?.col === 'status' ? sortState.dir : null, onSortClick: () => toggleSort('status') },
              { key: '__actions__', label: t('actions') }
            ]}
            data={visibleRows}
            onEdit={openEdit}
          />
        )}
      </div>
      {formOpen && (
        <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget && !saving) setFormOpen(false); }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing ? t('editAdvertiser') : t('newAdvertiser')}</span>
              <button className="modal-close" onClick={() => setFormOpen(false)} disabled={saving}>x</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>{t('advertiserName')} <span style={{ color: 'red' }}>*</span></label><input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} /></div>
              <div className="form-group"><label>{t('contact')} {!editing && <span style={{ color: 'red' }}>*</span>}</label><input type="text" value={form.contact} onChange={e => setForm(prev => ({ ...prev, contact: e.target.value }))} /></div>
              <div className="form-group"><label>{t('phone')} {!editing && <span style={{ color: 'red' }}>*</span>}</label><input type="text" value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} /></div>
              <div className="form-group"><label>{t('email')} {!editing && <span style={{ color: 'red' }}>*</span>}</label><input type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} /></div>
              <div className="form-group"><label>{t('notes')}</label><textarea rows={2} value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} /></div>
              <div className="form-group"><label>{t('status')}</label>
                <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value as EntityStatus }))}>
                  <option value="active">{t('online')}</option>
                  <option value="inactive">{t('offline')}</option>
                </select>
              </div>
              {formError && <div className="form-error">{formError}</div>}
            </div>
            <div className="modal-footer">
              {editing && (
                <button className="btn-danger" onClick={removeRecord} disabled={saving}>{t('delete')}</button>
              )}
              <button className="btn-outline" onClick={() => setFormOpen(false)} disabled={saving}>{t('cancel')}</button>
              <button className="btn-primary" onClick={submitForm} disabled={saving}>{t('submit')}</button>
            </div>
          </div>
        </div>
      )}
      <QuarantineConfirmModal
        open={quarantine.open}
        scope="advertiser"
        targetName={editing?.name ?? quarantine.targetName}
        loading={quarantine.loading}
        error={quarantine.error}
        result={quarantine.result}
        onConfirm={quarantine.confirm}
        onClose={quarantine.closeModal}
      />
      <HardDeleteModal
        open={hardDeleteOpen}
        entityName={editing?.name ?? ''}
        loading={hardDeleteLoading}
        error={hardDeleteError}
        result={hardDeleteResult}
        onConfirm={handleHardDeleteConfirm}
        onClose={handleHardDeleteClose}
        onGoToQuarantine={handleHardDeleteGoToQuarantine}
      />
    </div>
  );
}


function defaultAdIdForm(): AdIdFormState {
  return { advertiserId: '', adTypeId: '', slot: '', type: 'CPM' as const, unitPrice: '', ratio: '', notes: '', status: 'active' as EntityStatus };
}

function adIdFormFromRecord(record: AdId, adTypeId = ''): AdIdFormState {
  return {
    advertiserId: String(record.advertiserId),
    adTypeId,
    slot: record.slot ?? '',
    type: record.type as 'CPM' | 'CPC' | 'CPS' | 'CPA',
    unitPrice: (record.type === 'CPM' || record.type === 'CPC' || record.type === 'CPA') && record.rate != null ? String(record.rate) : '',
    ratio: record.type === 'CPS' && record.rate != null ? String(record.rate) : '',
    notes: record.notes ?? '',
    status: record.status,
  };
}

type AdIdFormState = {
  advertiserId: string;
  adTypeId: string;
  slot: string;
  type: 'CPM' | 'CPC' | 'CPS' | 'CPA';
  unitPrice: string;
  ratio: string;
  notes: string;
  status: EntityStatus;
};

export function AdIdMgmt() {
  const [search, setSearch] = React.useState('');
  const [advFilter, setAdvFilter] = React.useState('');
  const [orderFilter, setOrderFilter] = React.useState('');
  const [adIdFilter, setAdIdFilter] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [sortState, setSortState] = React.useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const toggleSort = (col: string) => {
    setSortState(prev => {
      if (prev?.col === col) return prev.dir === 'asc' ? { col, dir: 'desc' } : null;
      return { col, dir: 'asc' };
    });
  };
  const [advertisers, setAdvertisers] = React.useState<Advertiser[]>([]);
  const [adTypes, setAdTypes] = React.useState<AdType[]>([]);
  const [rows, setRows] = React.useState<AdId[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [editing, setEditing] = React.useState<AdId | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<AdIdFormState>(defaultAdIdForm());
  const [formError, setFormError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const { t, displayName, adIdPresetFilter, clearAdIdPresetFilter, can } = useAppContext();
  const canHardDelete = can('masterData.hardDelete');

  const quarantine = useQuarantineAction({
    scope: 'media',
    targetId: String(editing?.id ?? ''),
    targetName: editing?.slot ?? '',
  });

  const [hardDeleteOpen, setHardDeleteOpen] = React.useState(false);
  const [hardDeleteResult, setHardDeleteResult] = React.useState<HardDeleteResult | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = React.useState(false);
  const [hardDeleteError, setHardDeleteError] = React.useState('');
  const [hasDeps, setHasDeps] = React.useState<boolean | null>(null);

  const openHardDelete = (row?: AdId) => {
    if (row) setEditing(row);
    setHardDeleteResult(null);
    setHardDeleteError('');
    setHardDeleteOpen(true);
  };

  const handleHardDeleteConfirm = async () => {
    if (!editing) return;
    setHardDeleteLoading(true);
    setHardDeleteError('');
    try {
      const result = await hardDeleteAdId(editing.id);
      setHardDeleteResult(result);
      if (result.success) {
        setRows(prev => prev.filter(r => r.id !== editing.id));
        setFormOpen(false);
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

  const handleHardDeleteGoToQuarantine = () => {
    setHardDeleteOpen(false);
    quarantine.openModal();
  };

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [advertiserRows, adIdRows, typeRows] = await Promise.all([listAdvertisers(), listAdIds(), listAdTypes()]);
      setAdvertisers(advertiserRows as Advertiser[]);
      setRows(adIdRows as AdId[]);
      setAdTypes(typeRows as AdType[]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRows();
  }, [loadRows]);

  React.useEffect(() => {
    if (!adIdPresetFilter) return;
    setAdvFilter(adIdPresetFilter.ownerId);
    setOrderFilter(adIdPresetFilter.adTypeCode);
    setAdIdFilter('');
    setTypeFilter('');
    setStatusFilter('');
    setSearch('');
    clearAdIdPresetFilter();
  }, [adIdPresetFilter, clearAdIdPresetFilter]);

  const adTypeNameById = React.useMemo(() => new Map(adTypes.map(at => [String(at.id), at.name])), [adTypes]);
  const advertiserById = React.useMemo(
    () => new Map(advertisers.map(a => [String(a.id), a])),
    [advertisers]
  );
  // Một AdId thuộc về nhà QC; nhà QC có nhiều đơn QC → một AdId "mang" toàn bộ đơn QC của nhà sở hữu.
  const adIdAdTypeNames = React.useCallback(
    (row: AdId): string[] => {
      const owner = advertiserById.get(String(row.advertiserId));
      return owner ? getAdvertiserAdTypeNameList(owner, adTypeNameById) : [];
    },
    [advertiserById, adTypeNameById]
  );
  const selectedAdvertiser = React.useMemo(
    () => advertisers.find(advertiser => String(advertiser.id) === String(advFilter)),
    [advertisers, advFilter]
  );
  const adTypeScopedRows = React.useMemo(
    () => orderFilter ? rows.filter(row => adIdAdTypeNames(row).includes(orderFilter)) : rows,
    [orderFilter, rows, adIdAdTypeNames]
  );
  const advertiserOptions = React.useMemo(
    () => advertisers.filter(advertiser => !orderFilter || getAdvertiserAdTypeNameList(advertiser, adTypeNameById).includes(orderFilter)),
    [advertisers, orderFilter, adTypeNameById]
  );
  const advertiserScopedRows = React.useMemo(
    () => advFilter ? adTypeScopedRows.filter(row => String(row.advertiserId) === String(advFilter)) : adTypeScopedRows,
    [adTypeScopedRows, advFilter]
  );
  const adTypeOptions = React.useMemo(() => {
    const names = selectedAdvertiser
      ? getAdvertiserAdTypeNameList(selectedAdvertiser, adTypeNameById)
      : rows.flatMap(row => adIdAdTypeNames(row));
    // Filter so theo TÊN đơn QC → gom trùng để mỗi tên chỉ hiện 1 lần trong dropdown.
    return Array.from(new Set(names)).filter(Boolean).map(name => ({ id: name, name }));
  }, [rows, selectedAdvertiser, adTypeNameById, adIdAdTypeNames]);
  const adIdOptions = React.useMemo(
    () => advertiserScopedRows.map(row => ({ id: String(row.id), name: row.slot })).filter(item => item.name),
    [advertiserScopedRows]
  );
  const typeOptions = React.useMemo(
    () => Array.from(new Set(advertiserScopedRows.map(row => row.type).filter((t): t is 'CPM' | 'CPC' | 'CPS' | 'CPA' => t === 'CPM' || t === 'CPC' || t === 'CPS' || t === 'CPA'))),
    [advertiserScopedRows]
  );
  const keyword = normalizeText(search);
  const visibleRows = advertiserScopedRows.filter(row => {
    if (adIdFilter && String(row.id) !== adIdFilter) return false;
    if (typeFilter && row.type !== typeFilter) return false;
    if (statusFilter && row.status !== statusFilter) return false;
    if (!keyword) return true;
    const values = [
      row.advertiserName,
      adIdAdTypeNames(row).join(', '),
      row.slot,
      formatBillingMethodLabel(row.type),
      row.rate,
      row.status
    ];
    return values.some(value => normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword));
  }).sort((a, b) => {
    if (sortState) {
      let delta = 0;
      switch (sortState.col) {
        case 'slot':
          delta = (a.slot ?? '').localeCompare(b.slot ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'advertiserName':
          delta = displayName(a.advertiserName ?? '').localeCompare(displayName(b.advertiserName ?? ''), undefined, { sensitivity: 'base' });
          break;
        case 'adTypeCode':
          delta = adIdAdTypeNames(a).join(', ').localeCompare(adIdAdTypeNames(b).join(', '), undefined, { sensitivity: 'base' });
          break;
        case 'type':
          delta = (a.type ?? '').localeCompare(b.type ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'rate': {
          if (a.rate == null && b.rate != null) return sortState.dir === 'asc' ? 1 : -1;
          if (a.rate != null && b.rate == null) return sortState.dir === 'asc' ? -1 : 1;
          if (a.rate != null && b.rate != null) {
            const d = a.rate - b.rate;
            if (d !== 0) return sortState.dir === 'asc' ? d : -d;
          }
          break;
        }
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
  });

  const adIdColumns: CsvColumn<AdId>[] = [
    { label: t('advertiser'), value: r => displayName(r.advertiserName) },
    { label: t('adType'), value: r => adIdAdTypeNames(r).map(name => displayName(name)).join(', ') },
    { label: t('adId'), value: r => r.slot ?? '' },
    { label: t('type'), value: r => r.type ?? '' },
    { label: t('rate'), value: r => formatMgmtRate(r.type, r.rate) },
    { label: t('status'), value: r => r.status ?? '' },
  ];

  React.useEffect(() => {
    if (!advFilter) return;
    if (!advertiserOptions.some(advertiser => String(advertiser.id) === String(advFilter))) {
      setAdvFilter('');
    }
  }, [advFilter, advertiserOptions]);

  React.useEffect(() => {
    if (!orderFilter || !selectedAdvertiser) return;
    // orderFilter carries a display name; check against selected advertiser's adType names
    const selectedNames = selectedAdvertiser ? selectedAdvertiser.adTypes?.map(at => at.name) ?? [selectedAdvertiser.adTypeCode].filter(Boolean) : [];
    if (!selectedNames.includes(orderFilter)) {
      setOrderFilter('');
    }
  }, [orderFilter, selectedAdvertiser]);

  const openCreate = () => {
    setEditing(null);
    const advertiser = advertisers.find(item => String(item.id) === String(advFilter));
    const ids = advertiser ? getAdvertiserAdTypeIds(advertiser) : [];
    // Resolve orderFilter (display name) to adTypeId, but only keep it if the adType actually
    // belongs to the currently-filtered advertiser — otherwise fall back to the first
    // adType of that advertiser so submit doesn't fail with "adTypeId is not linked".
    const orderFilterName = orderFilter;
    const matchedAdType = orderFilterName ? adTypes.find(at => at.name === orderFilterName) : undefined;
    const matchedId = matchedAdType && ids.includes(matchedAdType.id) ? matchedAdType.id : '';
    setForm({ ...defaultAdIdForm(), advertiserId: advFilter, adTypeId: matchedId || ids[0] || '' });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (record: AdId) => {
    setEditing(record);
    const resolvedAdTypeId = record.adTypeId ?? adTypes.find(at => at.name === record.adTypeCode)?.id ?? '';
    setForm(adIdFormFromRecord(record, resolvedAdTypeId));
    setFormError('');
    setFormOpen(true);
    setHasDeps(null);
    getAdIdDependencies(String(record.id))
      .then((deps: any) => {
        const total = Object.values(deps as Record<string, number>).reduce((s: number, v: number) => s + v, 0);
        setHasDeps(total > 0);
      })
      .catch(() => setHasDeps(false));
  };

  const submitForm = async () => {
    if (!form.advertiserId) {
      setFormError(t('selectAdvertiser'));
      return;
    }
    if (!form.adTypeId) {
      setFormError(t('adOrderRequired') || 'Please select an ad order');
      return;
    }
    if (!form.slot.trim()) {
      setFormError(t('adId') + ' is required');
      return;
    }
    const type = form.type;
    if (type === 'CPM' || type === 'CPC' || type === 'CPA') {
      const price = parseFloat(form.unitPrice);
      if (!form.unitPrice || isNaN(price)) {
        setFormError(t('unitPriceRequired') || 'Please enter unit price');
        return;
      }
      if (price <= 0) {
        setFormError(t('unitPriceMustBePositive') || 'Unit price must be greater than 0');
        return;
      }
    } else {
      // CPS (revenue-share)
      const r = parseFloat(form.ratio);
      if (!form.ratio || isNaN(r)) {
        setFormError(t('ratioRequired') || 'Please enter ratio');
        return;
      }
      if (r <= 0 || r > 1) {
        setFormError(t('ratioMustBePositive') || 'Ratio must be between 0 and 1');
        return;
      }
    }
    const payload: CreateAdIdInput | UpdateAdIdInput = {
      advertiserId: form.advertiserId,
      adTypeId: form.adTypeId,
      slot: form.slot.trim(),
      type,
      unitPrice: type === 'CPM' || type === 'CPC' || type === 'CPA' ? parseFloat(form.unitPrice) : undefined,
      ratio: type === 'CPS' ? parseFloat(form.ratio) : undefined,
      notes: form.notes.trim() || null,
      status: form.status,
    };
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        const updated = await updateAdId(editing.id, payload);
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r));
      } else {
        const created = await createAdId(payload as CreateAdIdInput);
        setRows(prev => [...prev, created]);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async () => {
    if (!editing) return;
    if (!window.confirm(t('confirmDelete'))) return;
    if (canHardDelete && hasDeps === false) {
      setSaving(true);
      setFormError('');
      try {
        const result = await hardDeleteAdId(editing.id);
        if (result.success) {
          setRows(prev => prev.filter(r => r.id !== editing.id));
          setFormOpen(false);
        } else {
          setFormError(result.message || 'Unexpected error');
        }
      } catch (err) {
        setFormError(errorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }
    quarantine.openModal();
  };

  const updateStatus = async (record: AdId, active: boolean) => {
    const nextStatus: EntityStatus = active ? 'active' : 'inactive';
    try {
      const updated = await updateAdId(record.id, { status: nextStatus });
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pAdIdMgmt')}</h1></div>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left"><button className="btn-primary" onClick={openCreate}>{t('newAdId')}</button></div>
          <div className="toolbar-right">
            <select className="filter-select" value={advFilter} onChange={e => { setAdvFilter(e.target.value); setAdIdFilter(''); setTypeFilter(''); }}><option value="">{t('selectAdvertiser')}</option>{advertiserOptions.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}</select>
            <select className="filter-select" value={orderFilter} onChange={e => { setOrderFilter(e.target.value); setAdIdFilter(''); setTypeFilter(''); }}><option value="">{t('selectAdOrder')}</option>{adTypeOptions.map(type => <option key={type.id} value={type.name}>{displayName(type.name)}</option>)}</select>
            <select className="filter-select" value={adIdFilter} onChange={e => setAdIdFilter(e.target.value)}><option value="">{t('selectAdId')}</option>{adIdOptions.map(item => <option key={item.id} value={item.id}>{displayName(item.name)}</option>)}</select>
            <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">{t('filterType')}</option>{typeOptions.map(type => <option key={type} value={type}>{formatBillingMethodLabel(type)}</option>)}</select>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">{t('allStatuses')}</option><option value="active">{t('online')}</option><option value="inactive">{t('offline')}</option></select>
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-outline" onClick={() => downloadCsv('ad-ids.csv', adIdColumns, visibleRows)}>{t('export')}</button>
          </div>
        </div>
        {loading ? <LoadingState t={t} /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'advertiserName', label: t('advertiser'), render: r => displayName(r.advertiserName), sortDirection: sortState?.col === 'advertiserName' ? sortState.dir : null, onSortClick: () => toggleSort('advertiserName') },
              { key: 'adTypeCode', label: t('adType'), render: r => adIdAdTypeNames(r).map(n => displayName(n)).join(', '), sortDirection: sortState?.col === 'adTypeCode' ? sortState.dir : null, onSortClick: () => toggleSort('adTypeCode') },
              { key: 'slot', label: t('adId'), sortDirection: sortState?.col === 'slot' ? sortState.dir : null, onSortClick: () => toggleSort('slot') },
              { key: 'type', label: t('type'), render: r => <TypeTag tp={r.type} />, sortDirection: sortState?.col === 'type' ? sortState.dir : null, onSortClick: () => toggleSort('type') },
              { key: 'rate', label: t('rate'), render: r => formatMgmtRate(r.type, r.rate), sortDirection: sortState?.col === 'rate' ? sortState.dir : null, onSortClick: () => toggleSort('rate') },
              { key: 'notes', label: t('notes'), render: r => displayName(r.notes ?? '-'), sortDirection: sortState?.col === 'notes' ? sortState.dir : null, onSortClick: () => toggleSort('notes') },
              { key: 'status', label: t('status'), render: r => <StatusToggle status={r.status === 'active'} onChange={status => updateStatus(r, status)} />, sortDirection: sortState?.col === 'status' ? sortState.dir : null, onSortClick: () => toggleSort('status') },
              { key: '__actions__', label: t('actions') },
            ]}
            data={visibleRows}
            onEdit={openEdit}
          />
        )}
      </div>
      {formOpen && (
        <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget && !saving) setFormOpen(false); }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing ? t('editAdId') : t('newAdId')}</span>
              <button className="modal-close" onClick={() => setFormOpen(false)} disabled={saving}>x</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>{t('advertiser')} <span style={{ color: 'red' }}>*</span></label>
                <select value={form.advertiserId} onChange={e => setForm(prev => {
                  const advertiser = advertisers.find(a => String(a.id) === e.target.value);
                  const ids = advertiser ? getAdvertiserAdTypeIds(advertiser) : [];
                  const currentTypeName = adTypes.find(at => at.id === prev.adTypeId)?.name;
                  return {
                    ...prev,
                    advertiserId: e.target.value,
                    adTypeId: ids.length === 0
                      ? ''
                      : prev.adTypeId && ids.includes(prev.adTypeId)
                        ? prev.adTypeId
                        : ids[0],
                    adTypeCode: currentTypeName,
                  };
                })}>
                  <option value="">-</option>
                  {advertisers.filter(a => !form.adTypeId || getAdvertiserAdTypeIds(a).includes(form.adTypeId)).map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('adType')} <span style={{ color: 'red' }}>*</span></label>
                <select value={form.adTypeId} onChange={e => setForm(prev => {
                  const nextAdTypeId = e.target.value;
                  const currentAdvertiser = advertisers.find(a => String(a.id) === prev.advertiserId);
                  const currentAdvertiserIds = currentAdvertiser ? getAdvertiserAdTypeIds(currentAdvertiser) : [];
                  const nextName = adTypes.find(at => at.id === nextAdTypeId)?.name ?? '';
                  return { ...prev, adTypeId: nextAdTypeId, adTypeCode: nextName, advertiserId: currentAdvertiser && nextAdTypeId && !currentAdvertiserIds.includes(nextAdTypeId) ? '' : prev.advertiserId };
                })}>
                  <option value="">-</option>
                  {adTypes.filter(type => {
                    const advertiser = advertisers.find(a => String(a.id) === form.advertiserId);
                    return !advertiser || getAdvertiserAdTypeIds(advertiser).includes(type.id);
                  }).map(type => <option key={type.id} value={type.id}>{displayName(type.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('adId')} <span style={{ color: 'red' }}>*</span></label><input type="text" value={form.slot} onChange={e => setForm(prev => ({ ...prev, slot: e.target.value }))} /></div>
              <div className="form-group"><label>{t('type')} <span style={{ color: 'red' }}>*</span></label>
                <select value={form.type} onChange={e => setForm(prev => {
                  const nextType = e.target.value as 'CPM' | 'CPC' | 'CPS' | 'CPA';
                  return {
                    ...prev,
                    type: nextType,
                    ...(nextType === 'CPS'
                      ? { unitPrice: '' }
                      : { ratio: '' }),
                  };
                })}>
                  <option value="CPM">CPM</option>
                  <option value="CPC">CPC</option>
                  <option value="CPS">CPS</option>
                  <option value="CPA">CPA</option>
                </select>
              </div>
              {(form.type === 'CPM' || form.type === 'CPC' || form.type === 'CPA') && <div className="form-group"><label>{t('unitPrice')} <span style={{ color: 'red' }}>*</span></label><input type="number" step="0.01" min="0" value={form.unitPrice} onChange={e => setForm(prev => ({ ...prev, unitPrice: e.target.value }))} /></div>}
              {form.type === 'CPS' && <div className="form-group"><label>{t('revenueShare')} <span style={{ color: 'red' }}>*</span></label><input type="number" step="0.0001" min="0" max="1" value={form.ratio} onChange={e => setForm(prev => ({ ...prev, ratio: e.target.value }))} /></div>}
              <div className="form-group"><label>{t('notes')}</label><textarea rows={2} value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} /></div>
              <div className="form-group"><label>{t('status')}</label>
                <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value as EntityStatus }))}>
                  <option value="active">{t('online')}</option>
                  <option value="inactive">{t('offline')}</option>
                </select>
              </div>
              {formError && <div className="form-error">{formError}</div>}
            </div>
            <div className="modal-footer">
              {editing && (
                <button className="btn-danger" onClick={removeRecord} disabled={saving}>{t('delete')}</button>
              )}
              <button className="btn-outline" onClick={() => setFormOpen(false)} disabled={saving}>{t('cancel')}</button>
              <button className="btn-primary" onClick={submitForm} disabled={saving}>{t('submit')}</button>
            </div>
          </div>
        </div>
      )}
      <QuarantineConfirmModal
        open={quarantine.open}
        scope="media"
        targetName={editing?.slot ?? quarantine.targetName}
        loading={quarantine.loading}
        error={quarantine.error}
        result={quarantine.result}
        onConfirm={quarantine.confirm}
        onClose={quarantine.closeModal}
      />
      <HardDeleteModal
        open={hardDeleteOpen}
        entityName={editing?.slot ?? ''}
        loading={hardDeleteLoading}
        error={hardDeleteError}
        result={hardDeleteResult}
        onConfirm={handleHardDeleteConfirm}
        onClose={handleHardDeleteClose}
        onGoToQuarantine={handleHardDeleteGoToQuarantine}
      />
    </div>
  );
}
