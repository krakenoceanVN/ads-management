import { StatusToggle } from './Advertiser';
import React from 'react';
import { useAppContext } from '../AppContext';
import { Table, TypeTag } from '../components/Table';
import {
  createMedia,
  deleteMedia,
  getMedia,
  listAdOrders,
  listAdvertisers,
  listMedia,
  listMediaIds,
  updateMedia,
} from '../lib/bffApi';
import type {
  AdOrder,
  Advertiser,
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

type MediaFormState = {
  name: string;
  upstreamId: string;
  billingMethod: EntryType;
  currentUnitPrice: string;
  currentRatio: string;
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
  const { t, displayName } = useAppContext();

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
    if (form.billingMethod === 'RATIO') payload.currentRatio = toOptionalNumber(form.currentRatio);
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
    setSaving(true);
    setFormError('');
    try {
      await deleteMedia(editing.id);
      await loadRows();
      setFormOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
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
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
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
                    <option value="RATIO">CPS</option>
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
              <button className="btn-outline" onClick={() => setFormOpen(false)} disabled={saving}>{t('cancel')}</button>
              <button className="btn-primary" onClick={submitForm} disabled={saving}>{t('submit')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MediaAdOrderMgmt() {
  const [search, setSearch] = React.useState('');
  const [orders, setOrders] = React.useState<AdOrder[]>([]);
  const [mediaIds, setMediaIds] = React.useState<MediaId[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const { t, displayName } = useAppContext();

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orderRows, mediaIdRows] = await Promise.all([listAdOrders(), listMediaIds()]);
      setOrders(orderRows);
      setMediaIds(mediaIdRows);
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
    if (!keyword) return true;
    return [row.name, row.adTypeCode, row.notes].some(value =>
      normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword)
    );
  });

  const countMediaIds = (order: AdOrder) => mediaIds.filter(row => row.adTypeCode === order.adTypeCode).length;

  const mediaAdOrderColumns: CsvColumn<AdOrder>[] = [
    { label: t('mediaAdOrder'), value: r => displayName(r.name) },
    { label: 'Code', value: r => r.adTypeCode ?? '' },
    { label: t('mediaAdIdCount'), value: r => countMediaIds(r) },
    { label: t('notes'), value: r => r.notes ?? '-' },
  ];

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pMediaAdOrderMgmt')}</h1></div>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left"></div>
          <div className="toolbar-right">
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-outline" onClick={() => downloadCsv('media-ad-orders.csv', mediaAdOrderColumns, visibleRows)}>{t('export')}</button>
          </div>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'name', label: t('mediaAdOrder'), render: r => displayName(r.name) },
              { key: 'adTypeCode', label: 'Code' },
              { key: '__count__', label: t('mediaAdIdCount'), render: r => <span className={countMediaIds(r) ? '' : 'count-zero'}>{countMediaIds(r)}</span> },
              { key: 'notes', label: t('notes'), render: r => displayName(r.notes ?? '-') },
            ]}
            data={visibleRows}
          />
        )}
      </div>
    </div>
  );
}

export function MediaIdMgmt() {
  const [search, setSearch] = React.useState('');
  const [mediaFilter, setMediaFilter] = React.useState('');
  const [orderFilter, setOrderFilter] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [orders, setOrders] = React.useState<AdOrder[]>([]);
  const [rows, setRows] = React.useState<MediaId[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const { t, displayName, mediaIdPresetFilter, clearMediaIdPresetFilter } = useAppContext();

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orderRows, mediaIdRows] = await Promise.all([listAdOrders(), listMediaIds()]);
      setOrders(orderRows);
      setRows(mediaIdRows);
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
    if (!mediaIdPresetFilter) return;
    setMediaFilter(mediaIdPresetFilter.ownerId);
    setOrderFilter(mediaIdPresetFilter.orderId);
    setTypeFilter('');
    setSearch('');
    clearMediaIdPresetFilter();
  }, [mediaIdPresetFilter, clearMediaIdPresetFilter]);

  const orderById = React.useMemo(() => new Map(orders.map(order => [String(order.id), order])), [orders]);
  const orderNameByCode = React.useMemo(() => new Map(orders.map(order => [order.adTypeCode, order.name])), [orders]);
  const mediaOptions = React.useMemo(() => {
    const byId = new Map<number, string>();
    rows.forEach(row => byId.set(row.mediaId, row.mediaName));
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);
  const mediaScopedRows = mediaFilter ? rows.filter(row => row.mediaId === Number(mediaFilter)) : rows;
  const orderOptions = orders.filter(order => mediaScopedRows.some(row => row.adTypeCode === order.adTypeCode));
  const selectedOrder = orderFilter ? orderById.get(orderFilter) : undefined;
  const orderScopedRows = selectedOrder ? mediaScopedRows.filter(row => row.adTypeCode === selectedOrder.adTypeCode) : mediaScopedRows;
  const typeOptions = Array.from(new Set(orderScopedRows.map(row => row.type).filter(Boolean)));
  const keyword = normalizeText(search);
  const visibleRows = orderScopedRows.filter(row => {
    if (typeFilter && row.type !== typeFilter) return false;
    if (!keyword) return true;
    const values = [
      row.mediaName,
      orderNameByCode.get(row.adTypeCode),
      row.slot,
      row.type,
      row.rate,
      row.shareRatio,
      row.status
    ];
    return values.some(value => normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword));
  });

  const mediaIdColumns: CsvColumn<MediaId>[] = [
    { label: t('media'), value: r => displayName(r.mediaName) },
    { label: t('mediaAdOrder'), value: r => displayName(orderNameByCode.get(r.adTypeCode) ?? r.adTypeCode) },
    { label: t('mediaId'), value: r => r.slot ?? '' },
    { label: t('type'), value: r => r.type ?? '' },
    { label: t('rate'), value: r => formatMgmtRate(r.type, r.rate) },
    { label: t('shareRatio'), value: r => r.shareRatio ?? '-' },
    { label: t('status'), value: r => r.status ?? '' },
  ];

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pMediaIdMgmt')}</h1></div>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left"></div>
          <div className="toolbar-right">
            <select className="filter-select" value={mediaFilter} onChange={e => { setMediaFilter(e.target.value); setOrderFilter(''); setTypeFilter(''); }}><option value="">{t('selectMedia')}</option>{mediaOptions.map(item => <option key={item.id} value={item.id}>{displayName(item.name)}</option>)}</select>
            <select className="filter-select" value={orderFilter} onChange={e => { setOrderFilter(e.target.value); setTypeFilter(''); }}><option value="">{t('selectMediaAdOrder')}</option>{orderOptions.map(o => <option key={o.id} value={o.id}>{displayName(o.name)}</option>)}</select>
            <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">{t('filterType')}</option>{typeOptions.map(type => <option key={type} value={type}>{type}</option>)}</select>
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-outline" onClick={() => downloadCsv('media-ids.csv', mediaIdColumns, visibleRows)}>{t('export')}</button>
          </div>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'mediaName', label: t('media'), render: r => displayName(r.mediaName) },
              { key: 'adTypeCode', label: t('mediaAdOrder'), render: r => displayName(orderNameByCode.get(r.adTypeCode) ?? r.adTypeCode) },
              { key: 'slot', label: t('mediaId') },
              { key: 'type', label: t('type'), render: r => <TypeTag tp={r.type} /> },
              { key: 'rate', label: t('rate'), render: r => formatMgmtRate(r.type, r.rate) },
              { key: 'shareRatio', label: t('shareRatio'), render: r => r.shareRatio ?? '-' },
              { key: 'status', label: t('status'), render: r => r.status },
            ]}
            data={visibleRows}
          />
        )}
      </div>
    </div>
  );
}
