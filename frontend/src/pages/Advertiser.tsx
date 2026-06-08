import React from 'react';
import { useAppContext } from '../AppContext';
import { Table, TypeTag } from '../components/Table';
import { QuarantineConfirmModal } from '../components/QuarantineConfirmModal';
import { HardDeleteModal } from '../components/HardDeleteModal';
import { useQuarantineAction } from '../hooks/useQuarantineAction';
import {
  createAdvertiser,
  listAdIds,
  listAdOrders,
  listAdvertisers,
  listAdTypes,
  updateAdvertiser,
  createAdOrder,
  updateAdOrder,
  deleteAdOrder,
  createAdId,
  updateAdId,
  deleteAdId,
  hardDeleteAdvertiser,
  hardDeleteAdId,
  type HardDeleteResult,
} from '../lib/bffApi';
import type {
  AdId,
  AdOrder,
  Advertiser,
  AdType,
  CreateAdvertiserInput,
  EntityStatus,
  UpdateAdvertiserInput,
  CreateAdOrderInput,
  UpdateAdOrderInput,
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

function formatMgmtRate(type: string, rate: unknown) {
  if (rate == null || rate === '') return '';
  const num = Number(rate);
  if (Number.isNaN(num)) return String(rate);
  if (type === 'RATIO') {
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

function LoadingState() {
  return <div className="empty-state"><div className="empty-state-text">Loading...</div></div>;
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
  adTypeCode: string;
  status: EntityStatus;
  contact: string;
  phone: string;
  email: string;
  notes: string;
};

function defaultAdvertiserForm(adTypeCode = ''): AdvertiserFormState {
  return { name: '', adTypeCode, status: 'active', contact: '', phone: '', email: '', notes: '' };
}

function advertiserFormFromRecord(record: Advertiser, fallbackAdTypeCode = ''): AdvertiserFormState {
  return {
    name: record.name ?? '',
    adTypeCode: record.adTypeCode ?? fallbackAdTypeCode,
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
    targetId: editing?.id ?? 0,
    targetName: editing?.name ?? '',
  });

  const [hardDeleteOpen, setHardDeleteOpen] = React.useState(false);
  const [hardDeleteResult, setHardDeleteResult] = React.useState<HardDeleteResult | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = React.useState(false);
  const [hardDeleteError, setHardDeleteError] = React.useState('');

  const handleHardDeleteClick = () => {
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

  const advertiserColumns: CsvColumn<Advertiser>[] = [
    { label: t('advertiser'), value: r => displayName(r.name) },
    { label: t('adType'), value: r => r.adTypeCode ?? '' },
    { label: t('contact'), value: r => r.contact ?? '-' },
    { label: t('phone'), value: r => r.phone ?? '-' },
    { label: t('email'), value: r => r.email ?? '-' },
    { label: t('notes'), value: r => r.notes ?? '-' },
    { label: t('status'), value: r => r.status ?? '' },
  ];

  const adTypeOptions = adTypes;

  // Load AdTypes for the dropdown (all AdTypes, no filtering needed)
  const loadAdTypes = React.useCallback(async () => {
    try {
      const types = await listAdTypes();
      setAdTypes(types);
    } catch (err) {
      // Non-critical: keep existing on failure
    }
  }, []);

  // When advFilter changes — reload adTypes
  React.useEffect(() => {
    void loadAdTypes();
  }, [loadAdTypes]);

  // Reset adTypeCode when advertiser changes if no longer valid
  React.useEffect(() => {
    if (!advFilter) { /* cleared — no reset */ }
    else if (form.adTypeCode) {
      const isValidForAdv = adTypes.some(t => t.code === form.adTypeCode);
      if (!isValidForAdv) {
        setForm(prev => ({ ...prev, adTypeCode: adTypeOptions[0]?.code ?? '' }));
      }
    }
  }, [advFilter, adTypes, form.adTypeCode]);

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [advertisers, types] = await Promise.all([listAdvertisers(), listAdTypes()]);
      setRows(advertisers);
      setAdTypes(types);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const firstAdTypeCode = adTypeOptions[0]?.code ?? '';
  const keyword = normalizeText(search);
  const visibleRows = rows.filter(row => {
    if (advFilter && row.id !== Number(advFilter)) return false;
    if (!keyword) return true;
    return [
      row.name,
      row.adTypeCode,
      row.contact,
      row.phone,
      row.email,
      row.notes,
      row.status,
    ].some(value =>
      normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword)
    );
  });

  const openCreate = () => {
    setEditing(null);
    setForm(defaultAdvertiserForm(firstAdTypeCode));
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (record: Advertiser) => {
    setEditing(record);
    setForm(advertiserFormFromRecord(record, firstAdTypeCode));
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
      adTypeCode: form.adTypeCode,
      status: form.status,
      contact: form.contact.trim() || null,
      phone: form.phone.trim() || null,
      email: emailValue || null,
      notes: form.notes.trim() || null,
    };
    if (!payload.name || !payload.adTypeCode) {
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
              {rows.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}
            </select>
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-outline" onClick={() => downloadCsv('advertisers.csv', advertiserColumns, visibleRows)}>{t('export')}</button>
          </div>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'name', label: t('advertiser'), render: r => displayName(r.name) },
              { key: 'adTypeCode', label: t('adType') },
              { key: 'contact', label: t('contact'), render: r => displayName(r.contact ?? '-') },
              { key: 'phone', label: t('phone'), render: r => r.phone ?? '-' },
              { key: 'email', label: t('email'), render: r => r.email ?? '-' },
              { key: 'notes', label: t('notes'), render: r => displayName(r.notes ?? '-') },
              { key: 'status', label: t('status'), render: r => <StatusToggle status={r.status === 'active'} onChange={status => updateStatus(r, status)} /> },
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
              <div className="form-group"><label>{t('advertiserName')}</label><input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} /></div>
              <div className="form-group"><label>{t('adType')}</label>
                <select value={form.adTypeCode} onChange={e => setForm(prev => ({ ...prev, adTypeCode: e.target.value }))}>
                  <option value="">-</option>
                  {adTypeOptions.map(type => <option key={type.code} value={type.code}>{type.name} ({type.code})</option>)}
                </select>
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
              {editing && <button className="btn-danger" onClick={removeRecord} disabled={saving}>{t('delete')}</button>}
              {editing && canHardDelete && <button className="btn-danger" onClick={handleHardDeleteClick} disabled={saving}>{t('hardDelete')}</button>}
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

export function AdOrderMgmt() {
  const [search, setSearch] = React.useState('');
  const [advFilter, setAdvFilter] = React.useState('');
  const [advertisers, setAdvertisers] = React.useState<Advertiser[]>([]);
  const [orders, setOrders] = React.useState<AdOrder[]>([]);
  const [adIds, setAdIds] = React.useState<AdId[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [editing, setEditing] = React.useState<AdOrder | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState({ advertiserId: '', adTypeCode: '', name: '', notes: '', status: 'active' as EntityStatus });
  const [formError, setFormError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const { t, displayName, navigateToAdIds } = useAppContext();

  const advertiserName = (id: number) => {
    return displayName(advertisers.find(item => item.id === id)?.name ?? '-');
  };

  const quarantine = useQuarantineAction({
    scope: 'advertiser',
    targetId: editing?.advId ?? 0,
    targetName: editing ? advertiserName(editing.advId) : '',
  });

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [advertiserRows, orderRows, adIdRows] = await Promise.all([listAdvertisers(), listAdOrders(), listAdIds()]);
      setAdvertisers(advertiserRows);
      setOrders(orderRows);
      setAdIds(adIdRows);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const keyword = normalizeText(search);
  const visibleRows = orders.filter(row => {
    if (advFilter && row.advId !== Number(advFilter)) return false;
    if (!keyword) return true;
    return [row.name, row.adTypeCode, row.notes, advertiserName(row.advId)].some(value =>
      normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword)
    );
  });

  const countAdIds = (order: AdOrder) => adIds.filter(row =>
    row.adTypeCode === order.adTypeCode && (!advFilter || row.advertiserId === Number(advFilter))
  ).length;

  const adOrderColumns: CsvColumn<AdOrder>[] = [
    { label: t('advertiser'), value: r => displayName(advertiserName(r.advId)) },
    { label: t('adOrder'), value: r => displayName(r.name) },
    { label: 'Code', value: r => r.adTypeCode ?? '' },
    { label: t('adIdCount'), value: r => countAdIds(r) },
    { label: t('notes'), value: r => r.notes ?? '-' },
    { label: t('status'), value: r => r.status ?? '' },
  ];

  const openCreate = () => {
    setEditing(null);
    setForm({ advertiserId: advFilter || '', adTypeCode: '', name: '', notes: '', status: 'active' });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (record: AdOrder) => {
    setEditing(record);
    setForm({
      advertiserId: String(record.advId),
      adTypeCode: record.adTypeCode,
      name: record.name ?? '',
      notes: record.notes ?? '',
      status: record.status ?? 'active',
    });
    setFormError('');
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (!form.advertiserId || !form.adTypeCode || !form.name.trim()) {
      setFormError(t('requiredFields'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        advertiserId: Number(form.advertiserId),
        adTypeCode: form.adTypeCode,
        name: form.name.trim(),
        notes: form.notes.trim() || null,
        status: form.status,
      };
      if (editing) {
        await updateAdOrder(editing.id, payload);
      } else {
        await createAdOrder(payload as CreateAdOrderInput);
      }
      await loadRows();
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
    quarantine.openModal();
  };

  const updateStatus = async (record: AdOrder, active: boolean) => {
    if (record.isVirtual) return;
    const nextStatus: EntityStatus = active ? 'active' : 'inactive';
    try {
      await updateAdOrder(record.id, { status: nextStatus });
      await loadRows();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleSync = async (record: AdOrder) => {
    if (!record.isVirtual) return;
    if (!window.confirm(t('confirmSyncAdOrder') || 'Đồng bộ AdOrder cho nhà quảng cáo này?')) return;
    setSaving(true);
    setFormError('');
    try {
      const created = await createAdOrder({
        advertiserId: record.advId,
        adTypeCode: record.adTypeCode,
        name: record.name ?? `AdOrder ${record.adTypeCode}`,
        notes: null,
        status: 'active',
      });
      await loadRows();
      // Open edit form for the newly created real record
      setEditing(created);
      setForm({
        advertiserId: String(created.advId),
        adTypeCode: created.adTypeCode,
        name: created.name ?? '',
        notes: created.notes ?? '',
        status: created.status ?? 'active',
      });
      setFormError('');
      setFormOpen(true);
    } catch (err: any) {
      // Handle 409 conflict: record was created by another request — open it in edit mode
      if (err instanceof Error && (err as any).status === 409) {
        const existing = (err as any).payload?.data;
        if (existing) {
          await loadRows();
          setEditing(existing as AdOrder);
          setForm({
            advertiserId: String((existing as AdOrder).advId),
            adTypeCode: (existing as AdOrder).adTypeCode,
            name: (existing as AdOrder).name ?? '',
            notes: (existing as AdOrder).notes ?? '',
            status: (existing as AdOrder).status ?? 'active',
          });
          setFormError('');
          setFormOpen(true);
          setSaving(false);
          return;
        }
      }
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleVirtualDelete = (record: AdOrder) => {
    alert(t('cannotDeleteNotSynced') || 'Dòng này chưa có record quản lý AdOrder để xóa.');
  };

  const handleRowEdit = (record: AdOrder) => {
    if (record.isVirtual) {
      void handleSync(record);
    } else {
      setEditing(record);
      setForm({
        advertiserId: String(record.advId),
        adTypeCode: record.adTypeCode,
        name: record.name ?? '',
        notes: record.notes ?? '',
        status: record.status ?? 'active',
      });
      setFormError('');
      setFormOpen(true);
    }
  };

  const handleRowDelete = (record: AdOrder) => {
    if (record.isVirtual) {
      handleVirtualDelete(record);
    } else {
      setEditing(record);
      setForm({
        advertiserId: String(record.advId),
        adTypeCode: record.adTypeCode,
        name: record.name ?? '',
        notes: record.notes ?? '',
        status: record.status ?? 'active',
      });
      setFormError('');
      setFormOpen(true);
    }
  };

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pAdOrderMgmt')}</h1></div>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left"><button className="btn-primary" onClick={openCreate}>{t('newAdOrder')}</button></div>
          <div className="toolbar-right">
            <select className="filter-select" value={advFilter} onChange={e => setAdvFilter(e.target.value)}><option value="">{t('selectAdvertiser')}</option>{advertisers.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}</select>
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-outline" onClick={() => downloadCsv('ad-orders.csv', adOrderColumns, visibleRows)}>{t('export')}</button>
          </div>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'advId', label: t('advertiser'), render: r => advertiserName(r.advId) },
              { key: 'name', label: t('adOrder'), render: r => displayName(r.name) + (r.isVirtual ? ` (${t('notSynced') || 'Chưa đồng bộ'})` : '') },
              { key: 'adTypeCode', label: 'Code' },
              {
                key: '__count__',
                label: t('adIdCount'),
                render: r => {
                  const count = countAdIds(r);
                  if (!count || !advFilter) return <span className={count ? '' : 'count-zero'}>{count}</span>;
                  return <button type="button" className="count-link" onClick={() => navigateToAdIds(Number(advFilter), r.adTypeCode)}>{count}</button>;
                }
              },
              { key: 'notes', label: t('notes'), render: r => displayName(r.notes ?? '-') },
              { key: 'status', label: t('status'), render: r => <StatusToggle status={r.status === 'active'} onChange={status => updateStatus(r, status)} disabled={!!r.isVirtual} /> },
              { key: '__actions__', label: t('actions') },
            ]}
            data={visibleRows}
            onEdit={handleRowEdit}
            onDelete={handleRowDelete}
          />
        )}
      </div>
      {formOpen && (
        <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget && !saving) setFormOpen(false); }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing ? t('editAdOrder') : t('newAdOrder')}</span>
              <button className="modal-close" onClick={() => setFormOpen(false)} disabled={saving}>x</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>{t('advertiser')}</label>
                <select value={form.advertiserId} onChange={e => setForm(prev => ({ ...prev, advertiserId: e.target.value }))}>
                  <option value="">-</option>
                  {advertisers.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('selectAdOrder')}</label><input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} /></div>
              <div className="form-group"><label>{t('type')}</label>
                <select value={form.adTypeCode} onChange={e => setForm(prev => ({ ...prev, adTypeCode: e.target.value }))}>
                  <option value="">-</option>
                  {orders.filter(o => !advFilter || String(o.advId) === advFilter).map(o => <option key={o.adTypeCode} value={o.adTypeCode}>{displayName(o.name)} ({o.adTypeCode})</option>)}
                </select>
              </div>
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
              {editing && <button className="btn-danger" onClick={removeRecord} disabled={saving}>{t('delete')}</button>}
              <button className="btn-outline" onClick={() => setFormOpen(false)} disabled={saving}>{t('cancel')}</button>
              <button className="btn-primary" onClick={submitForm} disabled={saving}>{t('submit')}</button>
            </div>
          </div>
        </div>
      )}
      <QuarantineConfirmModal
        open={quarantine.open}
        scope="advertiser"
        targetName={editing ? advertiserName(editing.advId) : quarantine.targetName}
        loading={quarantine.loading}
        error={quarantine.error}
        result={quarantine.result}
        onConfirm={quarantine.confirm}
        onClose={quarantine.closeModal}
      />
    </div>
  );
}

function defaultAdIdForm(): AdIdFormState {
  return { advertiserId: '', adTypeCode: '', slot: '', type: 'CPM' as const, unitPrice: '', ratio: '', notes: '', status: 'active' as EntityStatus };
}

function adIdFormFromRecord(record: AdId): AdIdFormState {
  return {
    advertiserId: String(record.advertiserId),
    adTypeCode: record.adTypeCode ?? '',
    slot: record.slot ?? '',
    type: record.type as 'CPM' | 'RATIO' | 'CPA',
    unitPrice: (record.type === 'CPM' || record.type === 'CPA') && record.rate != null ? String(record.rate) : '',
    ratio: record.type === 'RATIO' && record.rate != null ? String(record.rate) : '',
    notes: '',
    status: record.status,
  };
}

type AdIdFormState = {
  advertiserId: string;
  adTypeCode: string;
  slot: string;
  type: 'CPM' | 'RATIO' | 'CPA';
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
    targetId: editing?.id ?? 0,
    targetName: editing?.slot ?? '',
  });

  const [hardDeleteOpen, setHardDeleteOpen] = React.useState(false);
  const [hardDeleteResult, setHardDeleteResult] = React.useState<HardDeleteResult | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = React.useState(false);
  const [hardDeleteError, setHardDeleteError] = React.useState('');

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
      setAdvertisers(advertiserRows);
      setRows(adIdRows);
      setAdTypes(typeRows);
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
    setSearch('');
    clearAdIdPresetFilter();
  }, [adIdPresetFilter, clearAdIdPresetFilter]);

  const adTypeNameByCode = React.useMemo(() => new Map(adTypes.map(at => [at.code, at.name ?? at.code])), [adTypes]);
  const advertiserOptions = advertisers.filter(advertiser => rows.some(row => row.advertiserId === advertiser.id));
  const advertiserScopedRows = advFilter ? rows.filter(row => row.advertiserId === Number(advFilter)) : rows;
  const adTypeOptions = adTypes.filter(adType => advertiserScopedRows.some(row => row.adTypeCode === adType.code));
  const orderScopedRows = orderFilter ? advertiserScopedRows.filter(row => row.adTypeCode === orderFilter) : advertiserScopedRows;
  const typeOptions = Array.from(new Set(orderScopedRows.map(row => row.type).filter(Boolean)));
  const keyword = normalizeText(search);
  const visibleRows = orderScopedRows.filter(row => {
    if (typeFilter && row.type !== typeFilter) return false;
    if (!keyword) return true;
    const values = [
      row.advertiserName,
      adTypeNameByCode.get(row.adTypeCode),
      row.slot,
      row.type,
      row.rate,
      row.status
    ];
    return values.some(value => normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword));
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultAdIdForm(), advertiserId: advFilter });
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
    if (!form.adTypeCode) {
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
      // RATIO (user-facing label: CPS)
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
      adTypeCode: form.adTypeCode,
      slot: form.slot.trim(),
      type,
      unitPrice: type === 'CPM' || type === 'CPA' ? parseFloat(form.unitPrice) : undefined,
      ratio: type === 'RATIO' ? parseFloat(form.ratio) : undefined,
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
    quarantine.openModal();
  };

  const updateStatus = async (record: AdId, active: boolean) => {
    const nextStatus: EntityStatus = active ? 'active' : 'inactive';
    try {
      const updated = await updateAdId(record.id, { status: nextStatus, adTypeCode: record.adTypeCode ?? '' });
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
            <select className="filter-select" value={advFilter} onChange={e => { setAdvFilter(e.target.value); setOrderFilter(''); setTypeFilter(''); }}><option value="">{t('selectAdvertiser')}</option>{advertiserOptions.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}</select>
            <select className="filter-select" value={orderFilter} onChange={e => { setOrderFilter(e.target.value); setTypeFilter(''); }}><option value="">{t('selectAdOrder')}</option>{adTypeOptions.map(type => <option key={type.code} value={type.code}>{displayName(type.name)} ({type.code})</option>)}</select>
            <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">{t('filterType')}</option>{typeOptions.map(type => <option key={type} value={type}>{type}</option>)}</select>
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'advertiserName', label: t('advertiser'), render: r => displayName(r.advertiserName) },
              { key: 'adTypeCode', label: t('adType'), render: r => displayName(adTypeNameByCode.get(r.adTypeCode) ?? r.adTypeCode) },
              { key: 'slot', label: t('adId') },
              { key: 'type', label: t('type'), render: r => <TypeTag tp={r.type} /> },
              { key: 'rate', label: t('rate'), render: r => formatMgmtRate(r.type, r.rate) },
              { key: 'status', label: t('status'), render: r => <StatusToggle status={r.status === 'active'} onChange={status => updateStatus(r, status)} /> },
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
              <div className="form-group"><label>{t('advertiser')}</label>
                <select value={form.advertiserId} onChange={e => setForm(prev => ({ ...prev, advertiserId: e.target.value, adTypeCode: '' }))}>
                  <option value="">-</option>
                  {advertisers.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('adType')}</label>
                <select value={form.adTypeCode} onChange={e => setForm(prev => ({ ...prev, adTypeCode: e.target.value }))}>
                  <option value="">-</option>
                  {adTypes.map(type => <option key={type.code} value={type.code}>{type.name} ({type.code})</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('adId')}</label><input type="text" value={form.slot} onChange={e => setForm(prev => ({ ...prev, slot: e.target.value }))} /></div>
              <div className="form-group"><label>{t('type')}</label>
                <select value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value as 'CPM' | 'RATIO' | 'CPA' }))}>
                  <option value="CPM">CPM</option>
                  <option value="RATIO">CPS</option>
                  <option value="CPA">CPA</option>
                </select>
              </div>
              {(form.type === 'CPM' || form.type === 'CPA') && <div className="form-group"><label>{t('unitPrice')}</label><input type="number" step="0.01" min="0" value={form.unitPrice} onChange={e => setForm(prev => ({ ...prev, unitPrice: e.target.value }))} /></div>}
              {form.type === 'RATIO' && <div className="form-group"><label>{t('ratio')}</label><input type="number" step="0.0001" min="0" max="1" value={form.ratio} onChange={e => setForm(prev => ({ ...prev, ratio: e.target.value }))} /></div>}
              <div className="form-group"><label>{t('status')}</label>
                <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value as EntityStatus }))}>
                  <option value="active">{t('online')}</option>
                  <option value="inactive">{t('offline')}</option>
                </select>
              </div>
              {formError && <div className="form-error">{formError}</div>}
            </div>
            <div className="modal-footer">
              {editing && <button className="btn-danger" onClick={removeRecord} disabled={saving}>{t('delete')}</button>}
              {editing && canHardDelete && <button className="btn-danger" onClick={openHardDelete} disabled={saving}>{t('hardDelete')}</button>}
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
