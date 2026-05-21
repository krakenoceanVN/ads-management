import React from 'react';
import { useAppContext } from '../AppContext';
import { Table, TypeTag } from '../components/Table';
import {
  createAdvertiser,
  deleteAdvertiser,
  listAdIds,
  listAdOrders,
  listAdvertisers,
  updateAdvertiser,
} from '../lib/bffApi';
import type {
  AdId,
  AdOrder,
  Advertiser,
  CreateAdvertiserInput,
  EntityStatus,
  UpdateAdvertiserInput,
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

type AdvertiserFormState = {
  name: string;
  adTypeCode: string;
  status: EntityStatus;
};

function defaultAdvertiserForm(adTypeCode = ''): AdvertiserFormState {
  return { name: '', adTypeCode, status: 'active' };
}

function advertiserFormFromRecord(record: Advertiser, fallbackAdTypeCode = ''): AdvertiserFormState {
  return {
    name: record.name ?? '',
    adTypeCode: record.adTypeCode ?? fallbackAdTypeCode,
    status: record.status ?? 'active',
  };
}

export function AdvertiserList() {
  const [search, setSearch] = React.useState('');
  const [rows, setRows] = React.useState<Advertiser[]>([]);
  const [adOrders, setAdOrders] = React.useState<AdOrder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState<Advertiser | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<AdvertiserFormState>(defaultAdvertiserForm());
  const [formError, setFormError] = React.useState('');
  const { t, displayName } = useAppContext();

  const advertiserColumns: CsvColumn<Advertiser>[] = [
    { label: t('advertiser'), value: r => displayName(r.name) },
    { label: t('adOrder'), value: r => r.adTypeCode ?? '' },
    { label: t('contact'), value: r => r.contact ?? '-' },
    { label: t('phone'), value: r => r.phone ?? '-' },
    { label: t('email'), value: r => r.email ?? '-' },
    { label: t('notes'), value: r => r.notes ?? '-' },
    { label: t('status'), value: r => r.status ?? '' },
  ];

  const adTypeOptions = React.useMemo(() => {
    const byCode = new Map<string, AdOrder>();
    adOrders.forEach(order => {
      if (order.adTypeCode) byCode.set(order.adTypeCode, order);
    });
    return Array.from(byCode.values());
  }, [adOrders]);

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [advertisers, orders] = await Promise.all([listAdvertisers(), listAdOrders()]);
      setRows(advertisers);
      setAdOrders(orders);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const firstAdTypeCode = adTypeOptions[0]?.adTypeCode ?? '';
  const keyword = normalizeText(search);
  const visibleRows = rows.filter(row => {
    if (!keyword) return true;
    return [row.name, row.adTypeCode, row.status].some(value =>
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
    const payload: CreateAdvertiserInput | UpdateAdvertiserInput = {
      name: form.name.trim(),
      adTypeCode: form.adTypeCode,
      status: form.status,
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
    setSaving(true);
    setFormError('');
    try {
      await deleteAdvertiser(editing.id);
      await loadRows();
      setFormOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
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
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-outline" onClick={() => downloadCsv('advertisers.csv', advertiserColumns, visibleRows)}>{t('export')}</button>
          </div>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'name', label: t('advertiser'), render: r => displayName(r.name) },
              { key: 'adTypeCode', label: t('adOrder') },
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
              <div className="form-group"><label>{t('adOrder')}</label>
                <select value={form.adTypeCode} onChange={e => setForm(prev => ({ ...prev, adTypeCode: e.target.value }))}>
                  <option value="">-</option>
                  {adTypeOptions.map(order => <option key={order.adTypeCode} value={order.adTypeCode}>{displayName(order.name)} ({order.adTypeCode})</option>)}
                </select>
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

export function AdOrderMgmt() {
  const [search, setSearch] = React.useState('');
  const [advFilter, setAdvFilter] = React.useState('');
  const [advertisers, setAdvertisers] = React.useState<Advertiser[]>([]);
  const [orders, setOrders] = React.useState<AdOrder[]>([]);
  const [adIds, setAdIds] = React.useState<AdId[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const { t, displayName, navigateToAdIds } = useAppContext();

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

  const advertiserName = (id: number | null) => {
    if (!id) return '-';
    return displayName(advertisers.find(item => item.id === id)?.name ?? '-');
  };

  const keyword = normalizeText(search);
  const visibleRows = orders.filter(row => {
    if (!keyword) return true;
    return [row.name, row.adTypeCode, row.notes, advertiserName(Number(advFilter) || row.advId)].some(value =>
      normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword)
    );
  });

  const countAdIds = (order: AdOrder) => adIds.filter(row =>
    row.adTypeCode === order.adTypeCode && (!advFilter || row.advertiserId === Number(advFilter))
  ).length;

  const adOrderColumns: CsvColumn<AdOrder>[] = [
    { label: t('advertiser'), value: r => displayName(advertiserName(Number(advFilter) || r.advId)) },
    { label: t('adOrder'), value: r => displayName(r.name) },
    { label: 'Code', value: r => r.adTypeCode ?? '' },
    { label: t('adIdCount'), value: r => countAdIds(r) },
    { label: t('notes'), value: r => r.notes ?? '-' },
  ];

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pAdOrderMgmt')}</h1></div>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left"></div>
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
              { key: 'advId', label: t('advertiser'), render: r => advertiserName(Number(advFilter) || r.advId) },
              { key: 'name', label: t('adOrder'), render: r => displayName(r.name) },
              { key: 'adTypeCode', label: 'Code' },
              {
                key: '__count__',
                label: t('adIdCount'),
                render: r => {
                  const count = countAdIds(r);
                  if (!count || !advFilter) return <span className={count ? '' : 'count-zero'}>{count}</span>;
                  return <button type="button" className="count-link" onClick={() => navigateToAdIds(Number(advFilter), r.id)}>{count}</button>;
                }
              },
              { key: 'notes', label: t('notes'), render: r => displayName(r.notes ?? '-') },
            ]}
            data={visibleRows}
          />
        )}
      </div>
    </div>
  );
}

export function AdIdMgmt() {
  const [search, setSearch] = React.useState('');
  const [advFilter, setAdvFilter] = React.useState('');
  const [orderFilter, setOrderFilter] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [advertisers, setAdvertisers] = React.useState<Advertiser[]>([]);
  const [orders, setOrders] = React.useState<AdOrder[]>([]);
  const [rows, setRows] = React.useState<AdId[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const { t, displayName, adIdPresetFilter, clearAdIdPresetFilter } = useAppContext();

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [advertiserRows, orderRows, adIdRows] = await Promise.all([listAdvertisers(), listAdOrders(), listAdIds()]);
      setAdvertisers(advertiserRows);
      setOrders(orderRows);
      setRows(adIdRows);
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
    setOrderFilter(adIdPresetFilter.orderId);
    setTypeFilter('');
    setSearch('');
    clearAdIdPresetFilter();
  }, [adIdPresetFilter, clearAdIdPresetFilter]);

  const orderById = React.useMemo(() => new Map(orders.map(order => [String(order.id), order])), [orders]);
  const orderNameByCode = React.useMemo(() => new Map(orders.map(order => [order.adTypeCode, order.name])), [orders]);
  const advertiserOptions = advertisers.filter(advertiser => rows.some(row => row.advertiserId === advertiser.id));
  const advertiserScopedRows = advFilter ? rows.filter(row => row.advertiserId === Number(advFilter)) : rows;
  const orderOptions = orders.filter(order => advertiserScopedRows.some(row => row.adTypeCode === order.adTypeCode));
  const selectedOrder = orderFilter ? orderById.get(orderFilter) : undefined;
  const orderScopedRows = selectedOrder ? advertiserScopedRows.filter(row => row.adTypeCode === selectedOrder.adTypeCode) : advertiserScopedRows;
  const typeOptions = Array.from(new Set(orderScopedRows.map(row => row.type).filter(Boolean)));
  const keyword = normalizeText(search);
  const visibleRows = orderScopedRows.filter(row => {
    if (typeFilter && row.type !== typeFilter) return false;
    if (!keyword) return true;
    const values = [
      row.advertiserName,
      orderNameByCode.get(row.adTypeCode),
      row.slot,
      row.type,
      row.rate,
      row.status
    ];
    return values.some(value => normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword));
  });

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pAdIdMgmt')}</h1></div>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left"></div>
          <div className="toolbar-right">
            <select className="filter-select" value={advFilter} onChange={e => { setAdvFilter(e.target.value); setOrderFilter(''); setTypeFilter(''); }}><option value="">{t('selectAdvertiser')}</option>{advertiserOptions.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}</select>
            <select className="filter-select" value={orderFilter} onChange={e => { setOrderFilter(e.target.value); setTypeFilter(''); }}><option value="">{t('selectAdOrder')}</option>{orderOptions.map(o => <option key={o.id} value={o.id}>{displayName(o.name)}</option>)}</select>
            <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">{t('filterType')}</option>{typeOptions.map(type => <option key={type} value={type}>{type}</option>)}</select>
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'advertiserName', label: t('advertiser'), render: r => displayName(r.advertiserName) },
              { key: 'adTypeCode', label: t('adOrder'), render: r => displayName(orderNameByCode.get(r.adTypeCode) ?? r.adTypeCode) },
              { key: 'slot', label: t('adId') },
              { key: 'type', label: t('type'), render: r => <TypeTag tp={r.type} /> },
              { key: 'rate', label: t('rate'), render: r => formatMgmtRate(r.type, r.rate) },
              { key: 'status', label: t('status'), render: r => r.status },
            ]}
            data={visibleRows}
          />
        )}
      </div>
    </div>
  );
}
