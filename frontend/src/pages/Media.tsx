import { StatusToggle } from './Advertiser';
import React from 'react';
import { useAppContext } from '../AppContext';
import { Table, TypeTag, type SortDirection } from '../components/Table';
import { QuarantineConfirmModal } from '../components/QuarantineConfirmModal';
import { useQuarantineAction } from '../hooks/useQuarantineAction';
import { HardDeleteModal } from '../components/HardDeleteModal';
import {
  createAdOrder,
  createMedia,
  createMediaId,
  getMedia,
  hardDeleteMedia,
  hardDeleteMediaAdOrder,
  hardDeleteMediaId,
  listAdOrders,
  listAdTypes,
  listAdvertisers,
  listDownstreams,
  listMedia,
  listMediaIds,
  updateAdOrder,
  updateMedia,
  updateMediaId,
} from '../lib/bffApi';
import type { HardDeleteResult } from '../lib/bffApi';
import type {
  AdOrder,
  AdType,
  Advertiser,
  CreateAdOrderInput,
  CreateMediaInput,
  EntityStatus,
  EntryType,
  Media,
  MediaId,
  UpdateMediaInput,
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

function normalizeText(value: unknown) {
  return String(value ?? '').toLowerCase();
}

function formatMgmtRate(_type: string, rate: unknown) {
  return String(rate ?? '');
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Request failed');
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

type MediaFormState = {
  name: string;
  upstreamId: string;
  billingMethod: EntryType;
  currentUnitPrice: string;
  currentRatio: string;
  status: EntityStatus;
};

type AdOrderFormState = {
  upstreamId: string;
  adTypeCode: string;
  name: string;
  notes: string;
  status: EntityStatus;
};

function isValidEmailForm(value: string) {
  const raw = value.trim();
  if (!raw) return true; // empty is allowed (optional field)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

function defaultMediaForm(upstreamId = ''): MediaFormState {
  return {
    name: '',
    upstreamId,
    billingMethod: 'CPM',
    currentUnitPrice: '',
    currentRatio: '',
    status: 'active',
  };
}

function defaultAdOrderForm(): AdOrderFormState {
  return {
    upstreamId: '',
    adTypeCode: '',
    name: '',
    notes: '',
    status: 'active',
  };
}

function adOrderFormFromRecord(record: AdOrder): AdOrderFormState {
  return {
    upstreamId: String(record.advId),
    adTypeCode: record.adTypeCode ?? '',
    name: record.name ?? '',
    notes: record.notes ?? '',
    status: record.status ?? 'active',
  };
}

function mediaFormFromRecord(record: Media, fallbackUpstreamId = ''): MediaFormState {
  return {
    name: record.name ?? '',
    upstreamId: String(record.upstreamId ?? fallbackUpstreamId),
    billingMethod: record.billingMethod ?? 'CPM',
    currentUnitPrice: record.currentUnitPrice != null ? String(record.currentUnitPrice) : '',
    currentRatio: record.currentRatio != null ? String(record.currentRatio) : '',
    status: record.status ?? 'active',
  };
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function MediaMgmt() {
  const [search, setSearch] = React.useState('');
  const [upstreamFilter, setUpstreamFilter] = React.useState('');
  const [rows, setRows] = React.useState<Media[]>([]);
  const [advertisers, setAdvertisers] = React.useState<Advertiser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState<Media | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<MediaFormState>(defaultMediaForm());
  const [formError, setFormError] = React.useState('');
  const { t, displayName, can } = useAppContext();
  const canHardDelete = can('masterData.hardDelete');

  const quarantine = useQuarantineAction({
    scope: 'media',
    targetId: editing?.id ?? 0,
    targetName: editing?.name ?? '',
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
      const result = await hardDeleteMedia(editing.id);
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

  const mediaColumns: CsvColumn<Media>[] = [
    { label: t('media'), value: r => displayName(r.name) },
    { label: t('advertiser'), value: r => advertiserName(r.upstreamId) },
    { label: t('type'), value: r => r.billingMethod ?? '' },
    { label: t('contact'), value: r => r.contact ?? '-' },
    { label: t('phone'), value: r => r.phone ?? '-' },
    { label: t('email'), value: r => r.email ?? '-' },
    { label: t('notes'), value: r => r.notes ?? '-' },
    { label: t('status'), value: r => r.status ?? '' },
  ];

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mediaRows, advertiserRows] = await Promise.all([listMedia(), listAdvertisers()]);
      setRows(mediaRows);
      setAdvertisers(advertiserRows);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const firstUpstreamId = advertisers[0]?.id ? String(advertisers[0].id) : '';
  const advertiserName = (id: number | undefined) => {
    if (!id) return '-';
    return displayName(advertisers.find(item => item.id === id)?.name ?? '-');
  };

  const keyword = normalizeText(search);
  const visibleRows = rows.filter(row => {
    if (upstreamFilter && row.upstreamId !== Number(upstreamFilter)) return false;
    if (!keyword) return true;
    return [row.name, row.upstreamId, advertiserName(row.upstreamId), row.billingMethod, row.status].some(value =>
      normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword)
    );
  });

  const openCreate = () => {
    setEditing(null);
    // v5.pdf cascade: pre-fill upstream with filter selection if set
    const defaultUpstream = upstreamFilter || firstUpstreamId;
    setForm(defaultMediaForm(defaultUpstream));
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (record: Media) => {
    setEditing(record);
    setForm(mediaFormFromRecord(record, firstUpstreamId));
    setFormError('');
    setFormOpen(true);
  };

  const buildPayload = (): CreateMediaInput | UpdateMediaInput | null => {
    const upstreamId = Number(form.upstreamId);
    if (!form.name.trim() || !upstreamId || !form.billingMethod) return null;
    const payload: CreateMediaInput | UpdateMediaInput = {
      name: form.name.trim(),
      upstreamId,
      billingMethod: form.billingMethod,
      status: form.status,
    };
    if (form.billingMethod === 'CPM') payload.currentUnitPrice = toOptionalNumber(form.currentUnitPrice);
    if (form.billingMethod === 'CPS') payload.currentRatio = toOptionalNumber(form.currentRatio);
    return payload;
  };

  const submitForm = async () => {
    const payload = buildPayload();
    if (!payload) {
      setFormError(t('requiredFields'));
      return;
    }

    // v5.pdf: validate email format when present in the advertiser's contact
    const selectedAdvertiser = advertisers.find(a => String(a.id) === form.upstreamId);
    if (selectedAdvertiser?.email && !isValidEmailForm(selectedAdvertiser.email)) {
      setFormError(t('invalidEmail') || 'Email không hợp lệ');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        const updated = await updateMedia(editing.id, payload);
        setRows(prev => prev.map(row => row.id === updated.id ? updated : row));
      } else {
        const created = await createMedia(payload as CreateMediaInput);
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

  const updateStatus = async (record: Media, active: boolean) => {
    const nextStatus: EntityStatus = active ? 'active' : 'inactive';
    try {
      const updated = await updateMedia(record.id, { status: nextStatus });
      setRows(prev => prev.map(row => row.id === updated.id ? updated : row));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pMediaMgmt')}</h1></div>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left"><button className="btn-primary" onClick={openCreate}>{t('newMedia')}</button></div>
          <div className="toolbar-right">
            <select className="filter-select" value={upstreamFilter} onChange={e => setUpstreamFilter(e.target.value)}>
              <option value="">{t('all') || 'Tất cả'}</option>
              {advertisers.map(item => <option key={item.id} value={item.id}>{displayName(item.name)}</option>)}
            </select>
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-outline" onClick={() => downloadCsv('media.csv', mediaColumns, visibleRows)}>{t('export')}</button>
          </div>
        </div>
        {loading ? <LoadingState t={t} /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'id', label: 'ID' },
              { key: 'name', label: t('media'), render: r => displayName(r.name) },
              { key: 'upstreamId', label: t('advertiser'), render: r => advertiserName(r.upstreamId) },
              { key: 'billingMethod', label: t('type') },
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
              <span className="modal-title">{editing ? t('editMedia') : t('newMedia')}</span>
              <button className="modal-close" onClick={() => setFormOpen(false)} disabled={saving}>x</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>{t('mediaName')}</label><input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} /></div>
              <div className="form-group"><label>{t('selectAdvertiser')}</label>
                <select value={form.upstreamId} onChange={e => setForm(prev => ({ ...prev, upstreamId: e.target.value }))}>
                  <option value="">-</option>
                  {advertisers.map(item => <option key={item.id} value={item.id}>{displayName(item.name)}</option>)}
                </select>
              </div>
              <div className="form-row cols2">
                <div className="form-group"><label>{t('type')}</label>
                  <select value={form.billingMethod} onChange={e => setForm(prev => ({ ...prev, billingMethod: e.target.value as EntryType }))}>
                    <option value="CPM">CPM</option>
                    <option value="CPS">CPS</option>
                    <option value="CPA">CPA</option>
                  </select>
                </div>
                <div className="form-group"><label>{form.billingMethod === 'CPM' ? t('unitPrice') : form.billingMethod === 'CPA' ? t('rate') : t('revenueShare')}</label>
                  <input
                    type="text"
                    value={form.billingMethod === 'CPM' ? form.currentUnitPrice : form.billingMethod === 'CPA' ? form.currentRatio : form.currentRatio}
                    onChange={e => setForm(prev => form.billingMethod === 'CPM' ? ({ ...prev, currentUnitPrice: e.target.value }) : ({ ...prev, currentRatio: e.target.value }))}
                  />
                </div>
              </div>
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

export function MediaAdOrderMgmt() {
  const [search, setSearch] = React.useState('');
  const [upstreamFilter, setUpstreamFilter] = React.useState('');
  const [rows, setRows] = React.useState<AdOrder[]>([]);
  const [adTypes, setAdTypes] = React.useState<AdType[]>([]);
  const [advertisers, setAdvertisers] = React.useState<Advertiser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState<AdOrder | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<AdOrderFormState>(defaultAdOrderForm());
  const [formError, setFormError] = React.useState('');
  const [nameSort, setNameSort] = React.useState<SortDirection>('asc');
  const [statusSort, setStatusSort] = React.useState<SortDirection>('asc');
  const { t, displayName, can, navigateToMediaIds } = useAppContext();
  const canHardDelete = can('masterData.hardDelete');
  const [hardDeleteOpen, setHardDeleteOpen] = React.useState(false);
  const [hardDeleteResult, setHardDeleteResult] = React.useState<HardDeleteResult | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = React.useState(false);
  const [hardDeleteError, setHardDeleteError] = React.useState('');

  const advertisersById = React.useMemo(
    () => new Map(advertisers.map(a => [a.id, a])),
    [advertisers]
  );

  const quarantine = useQuarantineAction({
    scope: 'advertiser',
    targetId: editing?.advId ?? 0,
    targetName: editing ? (advertisersById.get(editing.advId)?.name ?? '') : '',
  });

  const removeRecord = () => {
    if (!editing) return;
    if (!window.confirm(t('confirmDelete'))) return;
    quarantine.openModal();
  };

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mediaRows, advertiserRows, adTypeRows] = await Promise.all([
        listAdOrders(),
        listAdvertisers(),
        listAdTypes(),
      ]);
      setRows(mediaRows);
      setAdvertisers(advertiserRows);
      setAdTypes(adTypeRows);
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
  const visibleRows = rows.filter(row => {
    if (upstreamFilter && row.advId !== Number(upstreamFilter)) return false;
    if (!keyword) return true;
    const advertiserName = advertisersById.get(row.advId)?.name ?? '';
    return [row.name, row.adTypeCode, row.notes, advertiserName].some(value =>
      normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword)
    );
  }).sort((a, b) => {
    const aActive = a.status === 'active' ? 1 : 0;
    const bActive = b.status === 'active' ? 1 : 0;
    const statusDelta = aActive - bActive;
    const statusOrder = statusSort === 'asc' ? statusDelta : -statusDelta;
    if (statusOrder !== 0) return statusOrder;
    const nameA = a.name ?? '';
    const nameB = b.name ?? '';
    const nameDelta = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    const nameOrder = nameSort === 'asc' ? nameDelta : -nameDelta;
    if (nameOrder !== 0) return nameOrder;
    return a.id - b.id;
  });

  const toggleNameSort = () => setNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleStatusSort = () => setStatusSort(prev => (prev === 'asc' ? 'desc' : 'asc'));

  const updateStatus = async (record: AdOrder, active: boolean) => {
    const nextStatus: EntityStatus = active ? 'active' : 'inactive';
    try {
      await updateAdOrder(record.id, { status: nextStatus });
      await loadRows();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const mediaAdOrderColumns: CsvColumn<AdOrder>[] = [
    { label: t('mediaAdOrder'), value: r => displayName(r.name) },
    { label: t('adType'), value: r => displayName(adTypeNameByCode.get(r.adTypeCode) ?? r.adTypeCode) },
    { label: t('advertiser'), value: r => displayName(advertisersById.get(r.advId)?.name ?? '-') },
    { label: t('billingMethod'), value: r => (r.billingMethods?.length ? r.billingMethods.join(', ') : '-') },
    { label: t('adSiteCount'), value: r => r.adSiteCount ?? 0 },
    { label: t('notes'), value: r => r.notes ?? '-' },
  ];

  const openCreate = () => {
    setEditing(null);
    setForm(defaultAdOrderForm());
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (record: AdOrder) => {
    setEditing(record);
    setForm(adOrderFormFromRecord(record));
    setFormError('');
    setFormOpen(true);
  };

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
      const result = await hardDeleteMediaAdOrder(editing.id);
      setHardDeleteResult(result);
      if (result.success) {
        setRows(prev => prev.filter(row => row.id !== editing.id));
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

  const adTypeOptions = React.useMemo(() => {
    return adTypes.map(at => at.code).sort();
  }, [adTypes]);

  const adTypeNameByCode = React.useMemo(
    () => new Map(adTypes.map(at => [at.code, at.name ?? at.code])),
    [adTypes]
  );

  const submitForm = async () => {
    const upstreamId = Number(form.upstreamId);
    if (!upstreamId || !form.adTypeCode) {
      setFormError(t('requiredFields'));
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const trimmedName = form.name.trim();
      const payload: CreateAdOrderInput = {
        advertiserId: upstreamId,
        adTypeCode: form.adTypeCode,
        // Empty name = backend auto-generates `{adTypeCode}-{seq padded 3}`.
        // User-supplied names override the auto-generated value (rule 10).
        name: trimmedName || null,
        notes: form.notes.trim() || null,
        status: form.status,
      };

      if (editing) {
        const updated = await updateAdOrder(editing.id, {
          name: trimmedName,
          notes: form.notes.trim() || null,
          status: form.status,
        });
        await loadRows();
      } else {
        const created = await createAdOrder(payload);
        setRows(prev => [...prev, created]);
      }
      setFormOpen(false);
    } catch (err: unknown) {
      const apiErr = err as { status?: number; payload?: { data?: { data?: AdOrder } } };
      if (apiErr.status === 409 && apiErr.payload?.data?.data) {
        setFormOpen(false);
        openEdit(apiErr.payload.data.data);
        return;
      }
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pMediaAdOrderMgmt')}</h1></div>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left">
            <button className="btn-primary" onClick={openCreate}>{t('newMediaAdOrder')}</button>
          </div>
          <div className="toolbar-right">
            <select className="filter-select" value={upstreamFilter} onChange={e => setUpstreamFilter(e.target.value)}>
              <option value="">{t('selectAdvertiser')}</option>
              {advertisers.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}
            </select>
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-outline" onClick={() => downloadCsv('media-ad-orders.csv', mediaAdOrderColumns, visibleRows)}>{t('export')}</button>
          </div>
        </div>
        {loading ? <LoadingState t={t} /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'id', label: 'ID' },
              { key: 'name', label: t('mediaAdOrder'), render: r => {
                const dup = !!(r.adTypeName && r.name && r.name === r.adTypeName);
                return (
                  <span className="cell-name">
                    {displayName(r.name)}
                    {dup && (
                      <span
                        className="badge-warn"
                        title={t('duplicateNameWarning')}
                        aria-label={t('duplicateNameWarning')}
                      >⚠️</span>
                    )}
                  </span>
                );
              }, sortDirection: nameSort, onSortClick: toggleNameSort },
              { key: 'adTypeCode', label: t('adType'), render: r => displayName(adTypeNameByCode.get(r.adTypeCode) ?? r.adTypeCode) },
              { key: 'advId', label: t('advertiser'), render: r => displayName(advertisersById.get(r.advId)?.name ?? '-') },
              { key: 'billingMethods', label: t('billingMethod'), render: r => (r.billingMethods?.length ? r.billingMethods.join(', ') : '-') },
              {
                key: '__count__',
                label: t('adSiteCount'),
                render: r => {
                  const count = r.adSiteCount ?? 0;
                  if (!count || !upstreamFilter) return <span>{count}</span>;
                  return <button type="button" className="count-link" onClick={() => navigateToMediaIds(Number(upstreamFilter), r.adTypeCode)}>{count}</button>;
                }
              },
              { key: 'notes', label: t('notes'), render: r => displayName(r.notes ?? '-') },
              {
                key: 'status',
                label: t('status'),
                render: r => <StatusToggle status={r.status === 'active'} onChange={active => updateStatus(r, active)} />,
                sortDirection: statusSort,
                onSortClick: toggleStatusSort,
              },
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
              <span className="modal-title">{editing ? t('editMediaAdOrder') : t('newMediaAdOrder')}</span>
              <button className="modal-close" onClick={() => setFormOpen(false)} disabled={saving}>x</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>{t('selectAdvertiser')}</label>
                <select value={form.upstreamId} onChange={e => setForm(prev => ({ ...prev, upstreamId: e.target.value }))}>
                  <option value="">-</option>
                  {advertisers.map(item => <option key={item.id} value={item.id}>{displayName(item.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('adType')}</label>
                <select value={form.adTypeCode} onChange={e => setForm(prev => ({ ...prev, adTypeCode: e.target.value }))}>
                  <option value="">-</option>
                  {adTypes.map(at => <option key={at.code} value={at.code}>{displayName(at.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('mediaAdOrderName')}</label>
                <input
                  type="text"
                  value={form.name}
                  placeholder={t('autoGenNameHint')}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="form-group"><label>{t('notes')}</label>
                <input type="text" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
              </div>
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
      <HardDeleteModal
        open={hardDeleteOpen}
        entityName={editing?.name ?? ''}
        loading={hardDeleteLoading}
        error={hardDeleteError}
        result={hardDeleteResult}
        onConfirm={handleHardDeleteConfirm}
        onClose={handleHardDeleteClose}
      />
      <QuarantineConfirmModal
        open={quarantine.open}
        scope="advertiser"
        targetName={editing ? (advertisersById.get(editing.advId)?.name ?? '') : quarantine.targetName}
        loading={quarantine.loading}
        error={quarantine.error}
        result={quarantine.result}
        onConfirm={quarantine.confirm}
        onClose={quarantine.closeModal}
      />
    </div>
  );
}

export function MediaIdMgmt() {
  const [search, setSearch] = React.useState('');
  const [mediaFilter, setMediaFilter] = React.useState('');
  const [orderFilter, setOrderFilter] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [nameSort, setNameSort] = React.useState<SortDirection>('asc');
  const [statusSort, setStatusSort] = React.useState<SortDirection>('asc');
  const [adTypes, setAdTypes] = React.useState<AdType[]>([]);
  const [rows, setRows] = React.useState<MediaId[]>([]);
  const [advertisers, setAdvertisers] = React.useState<Advertiser[]>([]);
  const [adOrders, setAdOrders] = React.useState<AdOrder[]>([]);
  const [adSites, setAdSites] = React.useState<{ id: number; name: string; upstreamId: number; adOrderId: number | null; adTypeCode?: string }[]>([]);
  const [downstreams, setDownstreams] = React.useState<{ id: number; name: string; adTypeCodes: string[] }[]>([]);
  const [downstreamLoading, setDownstreamLoading] = React.useState(false);
  const [downstreamError, setDownstreamError] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState<MediaId | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState({ advertiserId: '', adOrderId: '', adSiteId: '', downstreamId: '', customPrice: '', status: 'active' as EntityStatus });
  const [formError, setFormError] = React.useState('');
  const { t, displayName, mediaIdPresetFilter, clearMediaIdPresetFilter, can } = useAppContext();
  const canHardDelete = can('masterData.hardDelete');

  const quarantine = useQuarantineAction({
    scope: 'media',
    targetId: editing?.adSiteId ?? 0,
    targetName: adSites.find(s => s.id === editing?.adSiteId)?.name ?? '',
  });

  const [hardDeleteOpen, setHardDeleteOpen] = React.useState(false);
  const [hardDeleteResult, setHardDeleteResult] = React.useState<HardDeleteResult | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = React.useState(false);
  const [hardDeleteError, setHardDeleteError] = React.useState('');


  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mediaIdRows, adSiteRows, adTypeRows, advertiserRows, adOrderRows] = await Promise.all([
        listMediaIds(),
        listMedia(),
        listAdTypes(),
        listAdvertisers(),
        listAdOrders(),
      ]);
      setRows(mediaIdRows);
      setAdSites(adSiteRows.map((s: Media) => ({ id: s.id, name: s.name, upstreamId: s.upstreamId ?? 0, adOrderId: s.adOrderId ?? null, adTypeCode: s.adTypeCode })));
      setAdTypes(adTypeRows);
      setAdvertisers(advertiserRows);
      setAdOrders(adOrderRows);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load downstreams from real API when form opens
  React.useEffect(() => {
    if (!formOpen) return;
    setDownstreamLoading(true);
    setDownstreamError('');
    listDownstreams()
      .then(data => {
        setDownstreams(data.map((d: { downstreamType: string; id: number; adTypeCode?: string; adTypeCodes?: string[] }) => ({
          id: d.id,
          name: d.downstreamType,
          adTypeCodes: d.adTypeCodes?.length ? d.adTypeCodes : d.adTypeCode ? [d.adTypeCode] : [],
        })));
      })
      .catch(() => setDownstreamError(t('failedToLoadDownstreams') || 'Failed to load downstreams'))
      .finally(() => setDownstreamLoading(false));
  }, [formOpen, t]);

  // Derive selected AdSite's adTypeCode from current form.adSiteId
  const selectedAdSite = React.useMemo(() =>
    adSites.find(s => String(s.id) === form.adSiteId),
    [adSites, form.adSiteId]
  );
  const selectedAdTypeCode = selectedAdSite?.adTypeCode;

  // Cascade: Advertiser → AdOrder options (filtered by advertiserId)
  const adOrderOptions = React.useMemo(() => {
    if (!form.advertiserId) return [];
    return adOrders.filter(o => String(o.advId) === form.advertiserId);
  }, [adOrders, form.advertiserId]);

  // Cascade: AdOrder → AdSite options (filtered by adOrderId)
  const adSiteOptions = React.useMemo(() => {
    if (!form.adOrderId) return [];
    return adSites.filter(s => String(s.adOrderId ?? '') === form.adOrderId);
  }, [adSites, form.adOrderId]);

  // Cascade: AdSite → Downstream options (filtered by AdSite's adTypeCode)
  const filteredDownstreams = React.useMemo(() => {
    if (!selectedAdTypeCode) return downstreams;
    return downstreams.filter(d => d.adTypeCodes.includes(selectedAdTypeCode));
  }, [downstreams, selectedAdTypeCode]);

  // When advertiser changes: reset adOrderId + adSiteId + downstreamId (strict)
  React.useEffect(() => {
    if (!form.advertiserId) {
      if (form.adOrderId || form.adSiteId || form.downstreamId) {
        setForm(prev => ({ ...prev, adOrderId: '', adSiteId: '', downstreamId: '' }));
      }
      return;
    }
    // advertiser set but adOrder set → if adOrder doesn't belong to this advertiser, reset
    if (form.adOrderId) {
      const stillValid = adOrders.some(o => String(o.id) === form.adOrderId && String(o.advId) === form.advertiserId);
      if (!stillValid) {
        setForm(prev => ({ ...prev, adOrderId: '', adSiteId: '', downstreamId: '' }));
      }
    }
  }, [form.advertiserId]); // intentionally not depending on form.adOrderId — only fires when advertiserId changes

  // When adOrder changes: reset adSiteId + downstreamId (strict)
  React.useEffect(() => {
    if (!form.adOrderId) {
      if (form.adSiteId || form.downstreamId) {
        setForm(prev => ({ ...prev, adSiteId: '', downstreamId: '' }));
      }
      return;
    }
    if (form.adSiteId) {
      const stillValid = adSites.some(s => String(s.id) === form.adSiteId && String(s.adOrderId ?? '') === form.adOrderId);
      if (!stillValid) {
        setForm(prev => ({ ...prev, adSiteId: '', downstreamId: '' }));
      }
    }
  }, [form.adOrderId]);

  // When adSite changes: reset downstreamId if not in filteredDownstreams
  React.useEffect(() => {
    if (!form.adSiteId) {
      if (form.downstreamId) {
        setForm(prev => ({ ...prev, downstreamId: '' }));
      }
      return;
    }
    if (form.downstreamId && selectedAdTypeCode) {
      const stillValid = filteredDownstreams.some(d => String(d.id) === form.downstreamId);
      if (!stillValid) {
        setForm(prev => ({ ...prev, downstreamId: '' }));
      }
    }
  }, [form.adSiteId, selectedAdTypeCode]);

  React.useEffect(() => {
    void loadRows();
  }, [loadRows]);

  React.useEffect(() => {
    if (!mediaIdPresetFilter) return;
    setMediaFilter(mediaIdPresetFilter.ownerId);
    setOrderFilter(mediaIdPresetFilter.adTypeCode);
    setTypeFilter('');
    setStatusFilter('');
    setSearch('');
    clearMediaIdPresetFilter();
  }, [mediaIdPresetFilter, clearMediaIdPresetFilter]);

  const adTypeNameByCode = React.useMemo(() => new Map(adTypes.map(t => [t.code, t.name ?? t.code])), [adTypes]);
  const mediaOptions = React.useMemo(() => {
    const byId = new Map<number, string>();
    rows.forEach(row => byId.set(row.mediaId, row.mediaName));
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);
  const mediaScopedRows = mediaFilter ? rows.filter(row => row.mediaId === Number(mediaFilter)) : rows;
  const availableAdTypeCodes = Array.from(new Set(mediaScopedRows.map(row => row.adTypeCode).filter(Boolean)));
  const adTypeOptions = adTypes.filter(t => availableAdTypeCodes.includes(t.code));
  const adTypeScopedRows = orderFilter ? mediaScopedRows.filter(row => row.adTypeCode === orderFilter) : mediaScopedRows;
  const typeOptions = Array.from(new Set(adTypeScopedRows.map(row => row.type).filter(Boolean)));
  const keyword = normalizeText(search);
  const visibleRows = adTypeScopedRows.filter(row => {
    if (typeFilter && row.type !== typeFilter) return false;
    if (statusFilter && row.status !== statusFilter) return false;
    if (!keyword) return true;
    const values = [
      row.mediaName,
      adTypeNameByCode.get(row.adTypeCode),
      row.slot,
      row.type,
      row.rate,
      row.shareRatio,
      row.status
    ];
    return values.some(value => normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword));
  }).sort((a, b) => {
    const aActive = a.status === 'active' ? 1 : 0;
    const bActive = b.status === 'active' ? 1 : 0;
    const statusDelta = aActive - bActive;
    const statusOrder = statusSort === 'asc' ? statusDelta : -statusDelta;
    if (statusOrder !== 0) return statusOrder;
    const nameA = a.mediaName ?? '';
    const nameB = b.mediaName ?? '';
    const nameDelta = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    const nameOrder = nameSort === 'asc' ? nameDelta : -nameDelta;
    if (nameOrder !== 0) return nameOrder;
    return a.id - b.id;
  });

  const toggleNameSort = () => setNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleStatusSort = () => setStatusSort(prev => (prev === 'asc' ? 'desc' : 'asc'));

  const mediaIdColumns: CsvColumn<MediaId>[] = [
    { label: t('media'), value: r => displayName(r.mediaName) },
    { label: t('mediaAdOrder'), value: r => displayName(adTypeNameByCode.get(r.adTypeCode) ?? r.adTypeCode) },
    { label: t('mediaId'), value: r => r.slot ?? '' },
    { label: t('type'), value: r => r.type ?? '' },
    { label: t('rate'), value: r => formatMgmtRate(r.type, r.rate) },
    { label: t('shareRatio'), value: r => r.shareRatio ?? '-' },
    { label: t('status'), value: r => r.status ?? '' },
  ];

  const openCreate = () => {
    setEditing(null);
    setForm({ advertiserId: '', adOrderId: '', adSiteId: '', downstreamId: '', customPrice: '', status: 'active' });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (record: MediaId) => {
    setEditing(record);
    // Derive Advertiser + AdOrder from the AdSite's adOrderId + upstreamId
    const site = adSites.find(s => s.id === record.adSiteId);
    const advId = site?.upstreamId ? String(site.upstreamId) : '';
    const adOrderId = site?.adOrderId ? String(site.adOrderId) : '';
    setForm({
      advertiserId: advId,
      adOrderId,
      adSiteId: String(record.adSiteId),
      downstreamId: String(record.downstreamId),
      customPrice: '',
      status: record.status,
    });
    setFormError('');
    setFormOpen(true);
  };

  const openHardDelete = () => {
    setHardDeleteResult(null);
    setHardDeleteError('');
    setHardDeleteOpen(true);
  };

  const handleHardDeleteConfirm = async () => {
    if (!editing?.junctionId) return;
    setHardDeleteLoading(true);
    setHardDeleteError('');
    try {
      const result = await hardDeleteMediaId(editing.junctionId);
      setHardDeleteResult(result);
      if (result.success) {
        setRows(prev => prev.filter(row => row.junctionId !== editing.junctionId));
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

  const submitForm = async () => {
    if (!form.advertiserId) { setFormError(t('selectAdvertiser')); return; }
    if (!form.adOrderId) { setFormError(t('selectAdOrder') || 'Vui lòng chọn đơn quảng cáo'); return; }
    const adSiteId = Number(form.adSiteId);
    if (!adSiteId) { setFormError(t('selectAdSite')); return; }
    const downstreamId = Number(form.downstreamId);
    if (!downstreamId) { setFormError(t('selectDownstream')); return; }

    setSaving(true);
    setFormError('');
    try {
      const payload: { adSiteId: number; downstreamId: number; customPrice?: number | null; status?: string } = {
        adSiteId,
        downstreamId,
      };
      const customPriceVal = form.customPrice.trim();
      if (customPriceVal) {
        const parsed = parseFloat(customPriceVal);
        if (Number.isFinite(parsed)) payload.customPrice = parsed;
      }

      if (editing && editing.junctionId) {
        // PUT to junction endpoint
        await updateMediaId(editing.junctionId, { customPrice: payload.customPrice ?? null });
        await loadRows();
      } else {
        const created = await createMediaId(payload as any);
        setRows(prev => [...prev, created]);
        await loadRows();
      }
      setFormOpen(false);
    } catch (err: unknown) {
      // mediaId.write.service.ts throws ConflictError on @@unique([adSiteId, downstreamId])
      // violation → BFF errorHandler maps ConflictError → HTTP 409 with code 'CONFLICT'.
      const apiErr = err as { status?: number; message?: string };
      if (apiErr.status === 409) {
        setFormError(t('mediaIdAlreadyExists') || 'Cặp ID quảng cáo – Downstream này đã được liên kết');
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async () => {
    if (!editing || !editing.junctionId) return;
    if (!window.confirm(t('confirmDelete'))) return;
    quarantine.openModal();
  };

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pMediaIdMgmt')}</h1></div>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left">
            <button className="btn-primary" onClick={openCreate}>{t('newMediaId')}</button>
          </div>
          <div className="toolbar-right">
            <select className="filter-select" value={mediaFilter} onChange={e => { setMediaFilter(e.target.value); setOrderFilter(''); setTypeFilter(''); }}><option value="">{t('selectMedia')}</option>{mediaOptions.map(item => <option key={item.id} value={item.id}>{displayName(item.name)}</option>)}</select>
            <select className="filter-select" value={orderFilter} onChange={e => { setOrderFilter(e.target.value); setTypeFilter(''); }}><option value="">{t('selectMediaAdOrder')}</option>{adTypeOptions.map(t => <option key={t.code} value={t.code}>{displayName(t.name ?? t.code)}</option>)}</select>
            <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">{t('filterType')}</option>{typeOptions.map(type => <option key={type} value={type}>{type}</option>)}</select>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">{t('allStatuses')}</option><option value="active">{t('online')}</option><option value="inactive">{t('offline')}</option></select>
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-outline" onClick={() => downloadCsv('media-ids.csv', mediaIdColumns, visibleRows)}>{t('export')}</button>
          </div>
        </div>
        {loading ? <LoadingState t={t} /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'junctionId', label: 'ID' },
              { key: 'mediaName', label: t('media'), render: r => displayName(r.mediaName), sortDirection: nameSort, onSortClick: toggleNameSort },
              { key: 'adTypeCode', label: t('mediaAdOrder'), render: r => displayName(adTypeNameByCode.get(r.adTypeCode) ?? r.adTypeCode) },
              { key: 'slot', label: t('mediaId') },
              { key: 'type', label: t('type'), render: r => <TypeTag tp={r.type} /> },
              { key: 'rate', label: t('rate'), render: r => formatMgmtRate(r.type, r.rate) },
              { key: 'shareRatio', label: t('shareRatio'), render: r => r.shareRatio ?? '-' },
              { key: 'status', label: t('status'), render: r => r.status, sortDirection: statusSort, onSortClick: toggleStatusSort },
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
              <span className="modal-title">{editing ? t('editMediaId') : t('newMediaId')}</span>
              <button className="modal-close" onClick={() => setFormOpen(false)} disabled={saving}>x</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>{t('advertiser')} <span style={{ color: 'red' }}>*</span></label>
                <select value={form.advertiserId} onChange={e => setForm(prev => ({ ...prev, advertiserId: e.target.value }))}>
                  <option value="">-</option>
                  {advertisers.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('selectAdOrder')} <span style={{ color: 'red' }}>*</span></label>
                <select value={form.adOrderId} onChange={e => setForm(prev => ({ ...prev, adOrderId: e.target.value }))} disabled={!form.advertiserId}>
                  <option value="">-</option>
                  {adOrderOptions.map(o => <option key={o.id} value={o.id}>{displayName(o.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('selectAdSite')} <span style={{ color: 'red' }}>*</span></label>
                <select value={form.adSiteId} onChange={e => setForm(prev => ({ ...prev, adSiteId: e.target.value }))} disabled={!form.adOrderId}>
                  <option value="">-</option>
                  {adSiteOptions.map(s => <option key={s.id} value={s.id}>{displayName(s.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('selectDownstream')} <span style={{ color: 'red' }}>*</span></label>
                <select value={form.downstreamId} onChange={e => setForm(prev => ({ ...prev, downstreamId: e.target.value }))} disabled={!form.adSiteId || downstreamLoading}>
                  <option value="">-</option>
                  {filteredDownstreams.map(item => <option key={item.id} value={item.id}>{item.name} ({item.adTypeCodes.join(', ')})</option>)}
                </select>
                {downstreamError && <div className="form-error">{downstreamError}</div>}
              </div>
              <div className="form-group"><label>{t('unitPriceRevenueShare')}</label>
                <input type="text" value={form.customPrice} onChange={e => setForm(prev => ({ ...prev, customPrice: e.target.value }))} placeholder={t('valuePlaceholder')} />
              </div>
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
        targetName={adSites.find(s => s.id === editing?.adSiteId)?.name ?? quarantine.targetName}
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
