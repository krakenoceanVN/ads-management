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

function getAdvertiserAdTypeNames(record: Advertiser, map: Map<string, string>): string {
  if (record.adTypes?.length) {
    return record.adTypes.map(at => at.name).join(', ');
  }
  return getAdvertiserAdTypeIds(record)
    .map(id => map.get(id) ?? id)
    .join(', ');
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
  const [advFilter, setAdvFilter] = React.useState('');
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

  const handleHardDeleteClick = (row?: Advertiser) => {
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

  const [statusSort, setStatusSort] = React.useState<SortDirection>('asc');
  const [nameSort, setNameSort] = React.useState<SortDirection>('asc');
  const [adTypeSort, setAdTypeSort] = React.useState<SortDirection>('asc');
  const [contactSort, setContactSort] = React.useState<SortDirection>('asc');
  const [phoneSort, setPhoneSort] = React.useState<SortDirection>('asc');
  const [emailSort, setEmailSort] = React.useState<SortDirection>('asc');
  const [notesSort, setNotesSort] = React.useState<SortDirection>('asc');

  const toggleStatusSort = () => {
    setStatusSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };
  const toggleNameSort = () => {
    setNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };
  const toggleAdTypeSort = () => setAdTypeSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleContactSort = () => setContactSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const togglePhoneSort = () => setPhoneSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleEmailSort = () => setEmailSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleNotesSort = () => setNotesSort(prev => (prev === 'asc' ? 'desc' : 'asc'));

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

  const adTypeOptions = adTypes;

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
    if (advFilter && row.status !== advFilter) return false;
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
    const aActive = a.status === 'active' ? 1 : 0;
    const bActive = b.status === 'active' ? 1 : 0;
    const statusDelta = aActive - bActive;
    const statusOrder = statusSort === 'asc' ? statusDelta : -statusDelta;
    if (statusOrder !== 0) return statusOrder;
    const nameA = displayName(a.name);
    const nameB = displayName(b.name);
    const nameDelta = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    const nameOrder = nameSort === 'asc' ? nameDelta : -nameDelta;
    if (nameOrder !== 0) return nameOrder;
    const adTypeA = getAdvertiserAdTypeNames(a, adTypeNameById);
    const adTypeB = getAdvertiserAdTypeNames(b, adTypeNameById);
    const adTypeDelta = adTypeA.localeCompare(adTypeB, undefined, { sensitivity: 'base' });
    const adTypeOrder = adTypeSort === 'asc' ? adTypeDelta : -adTypeDelta;
    if (adTypeOrder !== 0) return adTypeOrder;
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
  };

  const submitForm = async () => {
    const emailValue = form.email.trim();
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setFormError(t('invalidEmail') || 'Invalid email format');
      return;
    }
    const payload: CreateAdvertiserInput | UpdateAdvertiserInput = {
      name: form.name.trim(),
      adTypeId: form.adTypeIds[0] ?? '',
      adTypeIds: form.adTypeIds,
      status: form.status,
      contact: form.contact.trim() || null,
      phone: form.phone.trim() || null,
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

  const removeRecord = (row?: Advertiser) => {
    const target = row ?? editing;
    if (!target) return;
    if (!window.confirm(t('confirmDelete'))) return;
    setEditing(target);
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
            <select className="filter-select" value={advFilter} onChange={e => setAdvFilter(e.target.value)}>
              <option value="">{t('all') || 'Tất cả'}</option>
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
              { key: 'name', label: t('advertiser'), render: r => displayName(r.name), sortDirection: nameSort, onSortClick: toggleNameSort },
              { key: 'adTypeCode', label: t('adType'), render: r => getAdvertiserAdTypeNames(r, adTypeNameById), sortDirection: adTypeSort, onSortClick: toggleAdTypeSort },
              { key: 'contact', label: t('contact'), render: r => displayName(r.contact ?? '-'), sortDirection: contactSort, onSortClick: toggleContactSort },
              { key: 'phone', label: t('phone'), render: r => r.phone ?? '-', sortDirection: phoneSort, onSortClick: togglePhoneSort },
              { key: 'email', label: t('email'), render: r => r.email ?? '-', sortDirection: emailSort, onSortClick: toggleEmailSort },
              { key: 'notes', label: t('notes'), render: r => displayName(r.notes ?? '-'), sortDirection: notesSort, onSortClick: toggleNotesSort },
              { key: 'status', label: t('status'), render: r => <StatusToggle status={r.status === 'active'} onChange={status => updateStatus(r, status)} />, sortDirection: statusSort, onSortClick: toggleStatusSort },
              { key: '__actions__', label: t('actions') }
            ]}
            data={visibleRows}
            onEdit={openEdit}
            onDelete={removeRecord}
            onHardDelete={canHardDelete ? handleHardDeleteClick : undefined}
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
              <div className="form-group"><label>{t('adType')}</label>
                <div className="checkbox-list">
                  {adTypeOptions.map(type => {
                    const checked = form.adTypeIds.includes(type.id);
                    return (
                      <label key={type.id} className="checkbox-list-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setForm(prev => ({
                            ...prev,
                            adTypeIds: checked
                              ? prev.adTypeIds.filter(id => id !== type.id)
                              : [...prev.adTypeIds, type.id],
                          }))}
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
              <div className="form-group"><label>{t('contact')}</label><input type="text" value={form.contact} onChange={e => setForm(prev => ({ ...prev, contact: e.target.value }))} /></div>
              <div className="form-group"><label>{t('phone')}</label><input type="text" value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} /></div>
              <div className="form-group"><label>{t('email')}</label><input type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} /></div>
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

function adIdFormFromRecord(record: AdId): AdIdFormState {
  return {
    advertiserId: String(record.advertiserId),
    adTypeId: record.advertiserId ? record.adTypeCode ?? '' : '', // legacy placeholder; real value resolved via adType lookup below
    slot: record.slot ?? '',
    type: record.type as 'CPM' | 'CPS' | 'CPA',
    unitPrice: (record.type === 'CPM' || record.type === 'CPA') && record.rate != null ? String(record.rate) : '',
    ratio: record.type === 'CPS' && record.rate != null ? String(record.rate) : '',
    notes: record.notes ?? '',
    status: record.status,
  };
}

type AdIdFormState = {
  advertiserId: string;
  adTypeId: string;
  slot: string;
  type: 'CPM' | 'CPS' | 'CPA';
  unitPrice: string;
  ratio: string;
  notes: string;
  status: EntityStatus;
};

export function AdIdMgmt() {
  const [search, setSearch] = React.useState('');
  const [advFilter, setAdvFilter] = React.useState('');
  const [orderFilter, setOrderFilter] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [slotSort, setSlotSort] = React.useState<SortDirection>('asc');
  const [statusSort, setStatusSort] = React.useState<SortDirection>('asc');
  const [advertiserNameSort, setAdvertiserNameSort] = React.useState<SortDirection>('asc');
  const [adTypeCodeSort, setAdTypeCodeSort] = React.useState<SortDirection>('asc');
  const [typeSort, setTypeSort] = React.useState<SortDirection>('asc');
  const [rateSort, setRateSort] = React.useState<SortDirection>('asc');
  const [notesSort, setNotesSort] = React.useState<SortDirection>('asc');
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
    setTypeFilter('');
    setStatusFilter('');
    setSearch('');
    clearAdIdPresetFilter();
  }, [adIdPresetFilter, clearAdIdPresetFilter]);

  const adTypeNameById = React.useMemo(() => new Map(adTypes.map(at => [String(at.id), at.name])), [adTypes]);
  // Display label keyed by name (DTO's adTypeCode field = AdType.name after migration)
  const adTypeNameByName = React.useMemo(() => new Map(adTypes.map(at => [at.name, at.name])), [adTypes]);
  const selectedAdvertiser = React.useMemo(
    () => advertisers.find(advertiser => advertiser.id === Number(advFilter)),
    [advertisers, advFilter]
  );
  const selectedAdvertiserAdTypeIds = React.useMemo(
    () => selectedAdvertiser ? getAdvertiserAdTypeIds(selectedAdvertiser) : [],
    [selectedAdvertiser]
  );
  const adTypeScopedRows = React.useMemo(
    () => orderFilter ? rows.filter(row => row.adTypeCode === orderFilter) : rows,
    [orderFilter, rows]
  );
  const advertiserOptions = React.useMemo(
    () => advertisers.filter(advertiser => !orderFilter || getAdvertiserAdTypeNames(advertiser, adTypeNameByName).includes(orderFilter)),
    [advertisers, orderFilter, adTypeNameByName]
  );
  const advertiserScopedRows = React.useMemo(
    () => advFilter ? adTypeScopedRows.filter(row => String(row.advertiserId) === String(advFilter)) : adTypeScopedRows,
    [adTypeScopedRows, advFilter]
  );
  const adTypeOptions = React.useMemo(
    () => adTypes.filter(adType => selectedAdvertiser ? selectedAdvertiserAdTypeIds.includes(adType.id) : rows.some(row => row.adTypeCode === adType.name)),
    [adTypes, rows, selectedAdvertiser, selectedAdvertiserAdTypeIds]
  );
  const typeOptions = React.useMemo(
    () => Array.from(new Set(advertiserScopedRows.map(row => row.type).filter(Boolean))),
    [advertiserScopedRows]
  );
  const keyword = normalizeText(search);
  const visibleRows = advertiserScopedRows.filter(row => {
    if (typeFilter && row.type !== typeFilter) return false;
    if (statusFilter && row.status !== statusFilter) return false;
    if (!keyword) return true;
    const values = [
      row.advertiserName,
      adTypeNameByName.get(row.adTypeCode ?? '') ?? row.adTypeCode,
      row.slot,
      formatBillingMethodLabel(row.type),
      row.rate,
      row.status
    ];
    return values.some(value => normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword));
  }).sort((a, b) => {
    const aActive = a.status === 'active' ? 1 : 0;
    const bActive = b.status === 'active' ? 1 : 0;
    const statusDelta = aActive - bActive;
    const statusOrder = statusSort === 'asc' ? statusDelta : -statusDelta;
    if (statusOrder !== 0) return statusOrder;
    const slotA = a.slot ?? '';
    const slotB = b.slot ?? '';
    const slotDelta = slotA.localeCompare(slotB, undefined, { sensitivity: 'base' });
    const slotOrder = slotSort === 'asc' ? slotDelta : -slotDelta;
    if (slotOrder !== 0) return slotOrder;
    const advA = displayName(a.advertiserName ?? '');
    const advB = displayName(b.advertiserName ?? '');
    const advDelta = advA.localeCompare(advB, undefined, { sensitivity: 'base' });
    const advOrder = advertiserNameSort === 'asc' ? advDelta : -advDelta;
    if (advOrder !== 0) return advOrder;
    const adTypeA = adTypeNameByName.get(a.adTypeCode ?? '') ?? a.adTypeCode ?? '';
    const adTypeB = adTypeNameByName.get(b.adTypeCode ?? '') ?? b.adTypeCode ?? '';
    const adTypeDelta = adTypeA.localeCompare(adTypeB, undefined, { sensitivity: 'base' });
    const adTypeOrder = adTypeCodeSort === 'asc' ? adTypeDelta : -adTypeDelta;
    if (adTypeOrder !== 0) return adTypeOrder;
    const typeA = a.type ?? '';
    const typeB = b.type ?? '';
    const typeDelta = typeA.localeCompare(typeB, undefined, { sensitivity: 'base' });
    const typeOrder = typeSort === 'asc' ? typeDelta : -typeDelta;
    if (typeOrder !== 0) return typeOrder;
    const rateA = a.rate;
    const rateB = b.rate;
    if (rateA == null && rateB != null) return rateSort === 'asc' ? 1 : -1;
    if (rateA != null && rateB == null) return rateSort === 'asc' ? -1 : 1;
    if (rateA != null && rateB != null) {
      const rateDelta = rateA - rateB;
      const rateOrder = rateSort === 'asc' ? rateDelta : -rateDelta;
      if (rateOrder !== 0) return rateOrder;
    }
    const notesA = a.notes ?? '';
    const notesB = b.notes ?? '';
    const notesDelta = notesA.localeCompare(notesB, undefined, { sensitivity: 'base' });
    const notesOrder = notesSort === 'asc' ? notesDelta : -notesDelta;
    if (notesOrder !== 0) return notesOrder;
    return a.id - b.id;
  });

  const toggleSlotSort = () => setSlotSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleStatusSort = () => setStatusSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleAdvertiserNameSort = () => setAdvertiserNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleAdTypeCodeSort = () => setAdTypeCodeSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleTypeSort = () => setTypeSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleRateSort = () => setRateSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleNotesSort = () => setNotesSort(prev => (prev === 'asc' ? 'desc' : 'asc'));

  const adIdColumns: CsvColumn<AdId>[] = [
    { label: t('advertiser'), value: r => displayName(r.advertiserName) },
    { label: t('adType'), value: r => displayName(adTypeNameByName.get(r.adTypeCode ?? '') ?? r.adTypeCode ?? '') },
    { label: t('adId'), value: r => r.slot ?? '' },
    { label: t('type'), value: r => r.type ?? '' },
    { label: t('rate'), value: r => formatMgmtRate(r.type, r.rate) },
    { label: t('status'), value: r => r.status ?? '' },
  ];

  React.useEffect(() => {
    if (!advFilter) return;
    if (!advertiserOptions.some(advertiser => advertiser.id === Number(advFilter))) {
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
    const advertiser = advertisers.find(item => item.id === Number(advFilter));
    const ids = advertiser ? getAdvertiserAdTypeIds(advertiser) : [];
    // If orderFilter (which still carries display name) matches an advertiser adType name, resolve to id
    const orderFilterName = orderFilter;
    const matchedId = orderFilterName ? adTypes.find(at => at.name === orderFilterName)?.id ?? '' : '';
    setForm({ ...defaultAdIdForm(), advertiserId: advFilter, adTypeId: matchedId || ids[0] || '' });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (record: AdId) => {
    setEditing(record);
    setForm(adIdFormFromRecord(record));
    setFormError('');
    setFormOpen(true);
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
    if (type === 'CPM' || type === 'CPA') {
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
      advertiserId: Number(form.advertiserId),
      adTypeId: form.adTypeId,
      slot: form.slot.trim(),
      type,
      unitPrice: type === 'CPM' || type === 'CPA' ? parseFloat(form.unitPrice) : undefined,
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

  const removeRecord = (row?: AdId) => {
    const target = row ?? editing;
    if (!target) return;
    if (!window.confirm(t('confirmDelete'))) return;
    setEditing(target);
    quarantine.openModal();
  };

  const updateStatus = async (record: AdId, active: boolean) => {
    const nextStatus: EntityStatus = active ? 'active' : 'inactive';
    try {
      const adTypeId = adTypes.find(at => at.name === record.adTypeCode)?.id ?? '';
      const updated = await updateAdId(record.id, { status: nextStatus, adTypeId });
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
            <select className="filter-select" value={orderFilter} onChange={e => { setOrderFilter(e.target.value); setTypeFilter(''); }}><option value="">{t('selectAdOrder')}</option>{adTypeOptions.map(type => <option key={type.id} value={type.name}>{displayName(type.name)}</option>)}</select>
            <select className="filter-select" value={advFilter} onChange={e => { setAdvFilter(e.target.value); setTypeFilter(''); }}><option value="">{t('selectAdvertiser')}</option>{advertiserOptions.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}</select>
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
              { key: 'advertiserName', label: t('advertiser'), render: r => displayName(r.advertiserName), sortDirection: advertiserNameSort, onSortClick: toggleAdvertiserNameSort },
              { key: 'adTypeCode', label: t('adType'), render: r => displayName(adTypeNameByName.get(r.adTypeCode ?? '') ?? r.adTypeCode ?? ''), sortDirection: adTypeCodeSort, onSortClick: toggleAdTypeCodeSort },
              { key: 'slot', label: t('adId'), sortDirection: slotSort, onSortClick: toggleSlotSort },
              { key: 'type', label: t('type'), render: r => <TypeTag tp={r.type} />, sortDirection: typeSort, onSortClick: toggleTypeSort },
              { key: 'rate', label: t('rate'), render: r => formatMgmtRate(r.type, r.rate), sortDirection: rateSort, onSortClick: toggleRateSort },
              { key: 'notes', label: t('notes'), render: r => displayName(r.notes ?? '-'), sortDirection: notesSort, onSortClick: toggleNotesSort },
              { key: 'status', label: t('status'), render: r => <StatusToggle status={r.status === 'active'} onChange={status => updateStatus(r, status)} />, sortDirection: statusSort, onSortClick: toggleStatusSort },
              { key: '__actions__', label: t('actions') },
            ]}
            data={visibleRows}
            onEdit={openEdit}
            onDelete={removeRecord}
            onHardDelete={canHardDelete ? openHardDelete : undefined}
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
                  return { ...prev, advertiserId: e.target.value, adTypeId: prev.adTypeId && ids.includes(prev.adTypeId) ? prev.adTypeId : ids[0] ?? prev.adTypeId, adTypeCode: currentTypeName };
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
                <select value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value as 'CPM' | 'CPS' | 'CPA' }))}>
                  <option value="CPM">CPM</option>
                  <option value="CPS">CPS</option>
                  <option value="CPA">CPA</option>
                </select>
              </div>
              {(form.type === 'CPM' || form.type === 'CPA') && <div className="form-group"><label>{t('unitPrice')} <span style={{ color: 'red' }}>*</span></label><input type="number" step="0.01" min="0" value={form.unitPrice} onChange={e => setForm(prev => ({ ...prev, unitPrice: e.target.value }))} /></div>}
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
