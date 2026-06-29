import { StatusToggle } from './Advertiser';
import React from 'react';
import { useAppContext } from '../AppContext';
import { Table, TypeTag, type SortDirection } from '../components/Table';
import { QuarantineConfirmModal } from '../components/QuarantineConfirmModal';
import { useQuarantineAction } from '../hooks/useQuarantineAction';
import { HardDeleteModal } from '../components/HardDeleteModal';
import {
  createMediaAdOrder,
  createMediaId,
  hardDeleteMediaAdOrder,
  hardDeleteMediaId,
  listAdTypes,
  listAdvertisers,
  listDownstreams,
  listMedia,
  listMediaAdOrders,
  listMediaIds,
  updateMediaAdOrder,
  updateMediaId,
} from '../lib/bffApi';
import type { HardDeleteResult } from '../lib/bffApi';
import type {
  AdType,
  Advertiser,
  CreateMediaAdOrderInput,
  DownstreamDto,
  EntityStatus,
  Media,
  MediaAdOrder,
  MediaId,
  UpdateMediaAdOrderInput,
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

type AdOrderFormState = {
  downstreamId: string;
  name: string;
  notes: string;
  status: EntityStatus;
};

function defaultAdOrderForm(): AdOrderFormState {
  return {
    downstreamId: '',
    name: '',
    notes: '',
    status: 'active',
  };
}

function adOrderFormFromRecord(record: MediaAdOrder): AdOrderFormState {
  return {
    downstreamId: record.downstreamId ?? '',
    name: record.name ?? '',
    notes: record.notes ?? '',
    status: record.status ?? 'active',
  };
}

export function MediaAdOrderMgmt() {
  const [search, setSearch] = React.useState('');
  const [mediaFilter, setMediaFilter] = React.useState('');
  const [mediaAdOrderFilter, setMediaAdOrderFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [rows, setRows] = React.useState<MediaAdOrder[]>([]);
  const [adTypes, setAdTypes] = React.useState<AdType[]>([]);
  const [media, setMedia] = React.useState<Media[]>([]);
  const [downstreams, setDownstreams] = React.useState<DownstreamDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState<MediaAdOrder | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<AdOrderFormState>(defaultAdOrderForm());
  const [formError, setFormError] = React.useState('');
  const [sortState, setSortState] = React.useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const toggleSort = (col: string) => {
    setSortState(prev => {
      if (prev?.col === col) return prev.dir === 'asc' ? { col, dir: 'desc' } : null;
      return { col, dir: 'asc' };
    });
  };
  const { t, displayName, can } = useAppContext();
  const canHardDelete = can('masterData.hardDelete');
  const [hasDeps, setHasDeps] = React.useState<boolean | null>(false);
  const [hardDeleteOpen, setHardDeleteOpen] = React.useState(false);
  const [hardDeleteResult, setHardDeleteResult] = React.useState<HardDeleteResult | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = React.useState(false);
  const [hardDeleteError, setHardDeleteError] = React.useState('');

  const downstreamById = React.useMemo(
    () => new Map(downstreams.map(d => [String(d.id), d])),
    [downstreams]
  );

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mediaOrderRows, mediaRows, adTypeRows, downstreamRows] = await Promise.all([
        listMediaAdOrders(),
        listMedia(),
        listAdTypes(),
        listDownstreams(),
      ]);
      setRows(mediaOrderRows);
      setMedia(mediaRows);
      setAdTypes(adTypeRows);
      setDownstreams(downstreamRows ?? []);
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
    if (statusFilter && row.status !== statusFilter) return false;
    if (mediaFilter && row.downstreamId !== mediaFilter) return false;
    if (mediaAdOrderFilter && row.id !== mediaAdOrderFilter) return false;
    if (!keyword) return true;
    const downstream = downstreamById.get(row.downstreamId);
    const downstreamName = displayName(downstream?.name ?? downstream?.downstreamType ?? row.downstreamId);
    return [row.name, row.adTypeCode, row.notes, downstreamName].some(value =>
      normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword)
    );
  }).sort((a, b) => {
    if (sortState) {
      let delta = 0;
      switch (sortState.col) {
        case 'name':
          delta = (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'downstreamId': {
          const aDownstream = downstreamById.get(a.downstreamId);
          const bDownstream = downstreamById.get(b.downstreamId);
          delta = displayName(aDownstream?.name ?? aDownstream?.downstreamType ?? '').localeCompare(displayName(bDownstream?.name ?? bDownstream?.downstreamType ?? ''), undefined, { sensitivity: 'base' });
          break;
        }
        case 'linkCount':
          delta = (a.linkCount ?? 0) - (b.linkCount ?? 0);
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
    return a.id.localeCompare(b.id);
  });

  const updateStatus = async (record: MediaAdOrder, active: boolean) => {
    const nextStatus: EntityStatus = active ? 'active' : 'inactive';
    try {
      await updateMediaAdOrder(record.id, { status: nextStatus });
      await loadRows();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const mediaAdOrderColumns: CsvColumn<MediaAdOrder>[] = [
    { label: t('mediaAdOrder'), value: r => displayName(r.name) },
    { label: t('adType'), value: r => displayName(adTypeNameByName.get(r.adTypeCode ?? '') ?? r.adTypeCode ?? '') },
    { label: t('media'), value: r => {
      const downstream = downstreamById.get(r.downstreamId);
      return displayName(downstream?.name ?? downstream?.downstreamType ?? '-');
    } },
    { label: t('notes'), value: r => r.notes ?? '-' },
  ];

  const openCreate = () => {
    setEditing(null);
    setForm(defaultAdOrderForm());
    setFormError('');
    setFormOpen(true);
  };

  const removeRecord = async () => {
    if (!editing) return;
    if (!window.confirm(t('confirmDelete'))) return;
    setSaving(true);
    setFormError('');
    try {
      if (canHardDelete) {
        try {
          const result = await hardDeleteMediaAdOrder(editing.id);
          if (result.success) {
            setRows(prev => prev.filter(row => row.id !== editing.id));
            setFormOpen(false);
            return;
          }
        } catch {
          // fall through to soft delete
        }
      }
      await updateMediaAdOrder(editing.id, { status: 'inactive' });
      await loadRows();
      setFormOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (record: MediaAdOrder) => {
    setEditing(record);
    setForm(adOrderFormFromRecord(record));
    setFormError('');
    setFormOpen(true);
  };

  const openHardDelete = (row?: MediaAdOrder) => {
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

  const adTypeNameByName = React.useMemo(
    () => new Map(adTypes.map(at => [at.name, at.name])),
    [adTypes]
  );

  const submitForm = async () => {
    const trimmedName = form.name.trim();
    if (!form.downstreamId || !trimmedName) {
      setFormError(t('requiredFields'));
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload: CreateMediaAdOrderInput = {
        downstreamId: form.downstreamId,
        name: trimmedName,
        notes: form.notes.trim() || null,
        status: form.status,
      };

      if (editing) {
        const updatePayload: UpdateMediaAdOrderInput = {
          name: trimmedName,
          notes: form.notes.trim() || null,
          status: form.status,
        };
        await updateMediaAdOrder(editing.id, updatePayload);
        await loadRows();
      } else {
        await createMediaAdOrder(payload);
        await loadRows();
      }
      setFormOpen(false);
    } catch (err: unknown) {
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
            <select className="filter-select" value={mediaFilter} onChange={e => setMediaFilter(e.target.value)}>
              <option value="">{t('selectMedia')}</option>
              {downstreams.map(d => <option key={d.id} value={String(d.id)}>{displayName(d.name ?? d.downstreamType)}</option>)}
            </select>
            <select className="filter-select" value={mediaAdOrderFilter} onChange={e => setMediaAdOrderFilter(e.target.value)}>
              <option value="">{t('selectMediaAdOrder')}</option>
              {rows.map(row => <option key={row.id} value={row.id}>{displayName(row.name)}</option>)}
            </select>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">{t('allStatuses')}</option>
              <option value="active">{t('online')}</option>
              <option value="inactive">{t('offline')}</option>
            </select>
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-outline" onClick={() => downloadCsv('media-ad-orders.csv', mediaAdOrderColumns, visibleRows)}>{t('export')}</button>
          </div>
        </div>
        {loading ? <LoadingState t={t} /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'downstreamId', label: t('media'), render: r => {
                const downstream = downstreamById.get(r.downstreamId);
                return displayName(downstream?.name ?? downstream?.downstreamType ?? '-');
              }, sortDirection: sortState?.col === 'downstreamId' ? sortState.dir : null, onSortClick: () => toggleSort('downstreamId') },
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
              }, sortDirection: sortState?.col === 'name' ? sortState.dir : null, onSortClick: () => toggleSort('name') },
              { key: 'linkCount', label: t('linkCount'), render: r => r.linkCount ?? 0, sortDirection: sortState?.col === 'linkCount' ? sortState.dir : null, onSortClick: () => toggleSort('linkCount') },
              { key: 'notes', label: t('notes'), render: r => displayName(r.notes ?? '-'), sortDirection: sortState?.col === 'notes' ? sortState.dir : null, onSortClick: () => toggleSort('notes') },
              {
                key: 'status',
                label: t('status'),
                render: r => <StatusToggle status={r.status === 'active'} onChange={active => updateStatus(r, active)} />,
                sortDirection: sortState?.col === 'status' ? sortState.dir : null,
                onSortClick: () => toggleSort('status'),
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
              <div className="form-group"><label>{t('selectMedia')}</label>
                <select value={form.downstreamId} onChange={e => setForm(prev => ({ ...prev, downstreamId: e.target.value }))}>
                  <option value="">-</option>
                  {downstreams.map(item => <option key={item.id} value={String(item.id)}>{displayName(item.name ?? item.downstreamType)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('mediaAdOrderName')} <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  value={form.name}
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
              {editing && (
                <button className="btn-danger" onClick={removeRecord} disabled={saving}>{t('delete')}</button>
              )}
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
    </div>
  );
}

export function MediaIdMgmt() {
  const [search, setSearch] = React.useState('');
  const [mediaFilter, setMediaFilter] = React.useState('');
  const [orderFilter, setOrderFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [sortState, setSortState] = React.useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const toggleSort = (col: string) => {
    setSortState(prev => {
      if (prev?.col === col) return prev.dir === 'asc' ? { col, dir: 'desc' } : null;
      return { col, dir: 'asc' };
    });
  };
  const [adTypes, setAdTypes] = React.useState<AdType[]>([]);
  const [rows, setRows] = React.useState<MediaId[]>([]);
  const [advertisers, setAdvertisers] = React.useState<Advertiser[]>([]);
  const [adSites, setAdSites] = React.useState<{ id: string; name: string; upstreamId: string; adTypeCode?: string }[]>([]);
  const [downstreams, setDownstreams] = React.useState<{ id: string; name: string; adTypeIds: string[] }[]>([]);
  const [downstreamLoading, setDownstreamLoading] = React.useState(false);
  const [downstreamError, setDownstreamError] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState<MediaId | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  // Form 8 fields per docx §2.3:
  //   1. Nhà quảng cáo (advertiser)
  //   2. Đơn quảng cáo (adType) — filter theo advertiser
  //   3. ID quảng cáo (adSite) — filter theo advertiser + adType
  //   4. MEDIA — dropdown chọn Downstream (ML/LE/YIYI)
  //   5. Đơn quảng cáo MEDIA — dropdown chọn MediaAdOrder (filter theo adSite + downstream)
  //   6. ID MEDIA (mediaIdName) — text input do người dùng tự đặt
  //   7. Cột chia lợi nhuận từng link Ở hạ nguồn (pctHal)
  //   8. Đơn giá Ở hạ nguồn (customPrice)
  const [form, setForm] = React.useState({
    advertiserId: '',
    adTypeId: '',
    adSiteId: '',
    downstreamId: '',
    mediaAdOrderId: '',
    mediaIdName: '',
    pctHal: '',
    customPrice: '',
    status: 'active' as EntityStatus,
  });
  const [mediaAdOrders, setMediaAdOrders] = React.useState<MediaAdOrder[]>([]);
  const [formError, setFormError] = React.useState('');
  const { t, displayName, mediaIdPresetFilter, clearMediaIdPresetFilter, can } = useAppContext();
  const canHardDelete = can('masterData.hardDelete');
  const [hasDeps, setHasDeps] = React.useState<boolean | null>(false);

  const [hardDeleteOpen, setHardDeleteOpen] = React.useState(false);
  const [hardDeleteResult, setHardDeleteResult] = React.useState<HardDeleteResult | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = React.useState(false);
  const [hardDeleteError, setHardDeleteError] = React.useState('');


  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mediaIdRows, adSiteRows, adTypeRows, advertiserRows] = await Promise.all([
        listMediaIds(),
        listMedia(),
        listAdTypes(),
        listAdvertisers(),
      ]);
      setRows(mediaIdRows);
      setAdSites(adSiteRows.map((s: Media) => ({ id: String(s.id), name: s.name, upstreamId: String(s.upstreamId ?? ''), adTypeCode: s.adTypeCode })));
      setAdTypes(adTypeRows);
      setAdvertisers(advertiserRows);
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
        setDownstreams(data.map((d: { downstreamType: string; id: string | number; adTypeIds?: string[]; adTypeCodes?: string[]; adTypeCode?: string }) => ({
          id: String(d.id),
          name: d.downstreamType,
          adTypeIds: d.adTypeIds?.length ? d.adTypeIds : d.adTypeCodes?.length ? d.adTypeCodes : d.adTypeCode ? [d.adTypeCode] : [],
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
  const selectedAdTypeName = selectedAdSite?.adTypeCode; // DTO adTypeCode is now display name
  const selectedAdTypeId = React.useMemo(
    () => adTypes.find(at => at.name === selectedAdTypeName)?.id,
    [adTypes, selectedAdTypeName]
  );

  // Cascade (1) Advertiser → AdType options (lọc theo upstreamId)
  const advertiserAdTypeOptions = React.useMemo(() => {
    if (!form.advertiserId) return [];
    const adv = advertisers.find(a => String(a.id) === form.advertiserId);
    if (!adv) return [];
    const names = (adv.adTypeCodes && adv.adTypeCodes.length) ? adv.adTypeCodes : (adv.adTypeCode ? [adv.adTypeCode] : []);
    return adTypes.filter(at => names.includes(at.name));
  }, [form.advertiserId, advertisers, adTypes]);

  // Cascade (2) Advertiser → AdSite options (lọc theo upstreamId)
  const adSiteOptions = React.useMemo(() => {
    if (!form.advertiserId) return [];
    return adSites.filter(s => String(s.upstreamId) === form.advertiserId);
  }, [adSites, form.advertiserId]);

  // Cascade (3) AdSite → filtered adTypeCode
  // (cascading forward: chọn AdSite sẽ tự fill adTypeId)
  React.useEffect(() => {
    if (selectedAdTypeId && form.adTypeId !== selectedAdTypeId) {
      setForm(prev => ({ ...prev, adTypeId: selectedAdTypeId }));
    }
  }, [selectedAdTypeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cascade (4) MEDIA: dropdown Downstream (ML/LE/YIYI) — filter theo AdSite's adType
  const filteredDownstreamOptions = React.useMemo(() => {
    if (!selectedAdTypeId) return downstreams;
    return downstreams.filter(d => d.adTypeIds.includes(selectedAdTypeId));
  }, [downstreams, selectedAdTypeId]);

  // Cascade (5) Đơn QC MEDIA: dropdown MediaAdOrder của cùng Downstream đã chọn
  const filteredMediaAdOrderOptions = React.useMemo(() => {
    if (!form.downstreamId) return [];
    return mediaAdOrders.filter(mao => mao.downstreamId === form.downstreamId);
  }, [mediaAdOrders, form.downstreamId]);

  // Load MediaAdOrders khi đã chọn Downstream
  React.useEffect(() => {
    if (!form.downstreamId) {
      setMediaAdOrders([]);
      return;
    }
    listMediaAdOrders({ downstreamId: form.downstreamId })
      .then(setMediaAdOrders)
      .catch(() => setMediaAdOrders([]));
  }, [form.downstreamId]);

  // Khi sửa: khôi phục dropdown Đơn QC MEDIA từ mediaAdTypeCode đã lưu (qua mediaAdTypeId).
  // Lưu ý: nhiều MediaAdOrder cùng AdType sẽ khớp cái đầu tiên (giới hạn của việc lưu qua mediaAdTypeId).
  React.useEffect(() => {
    if (!editing || form.mediaAdOrderId || !mediaAdOrders.length) return;
    const code = editing.mediaAdTypeCode;
    if (!code) return;
    const match = mediaAdOrders.find(m => m.adTypeCode === code);
    if (match) setForm(prev => ({ ...prev, mediaAdOrderId: match.id }));
  }, [editing, mediaAdOrders, form.mediaAdOrderId]);

  // When advertiser changes: reset các field phụ thuộc
  React.useEffect(() => {
    if (!form.advertiserId) {
      setForm(prev => ({ ...prev, adTypeId: '', adSiteId: '', downstreamId: '', mediaAdOrderId: '', mediaIdName: '', pctHal: '', customPrice: '' }));
    }
  }, [form.advertiserId]);

  // When AdSite changes: clear downstream + mediaAdOrder
  React.useEffect(() => {
    if (!form.adSiteId) {
      setForm(prev => ({ ...prev, downstreamId: '', mediaAdOrderId: '' }));
    }
  }, [form.adSiteId]);

  React.useEffect(() => {
    void loadRows();
  }, [loadRows]);

  React.useEffect(() => {
    if (!mediaIdPresetFilter) return;
    setMediaFilter(mediaIdPresetFilter.ownerId);
    setOrderFilter(mediaIdPresetFilter.adTypeCode);
    setStatusFilter('');
    setSearch('');
    clearMediaIdPresetFilter();
  }, [mediaIdPresetFilter, clearMediaIdPresetFilter]);

  const adTypeNameByName = React.useMemo(() => new Map(adTypes.map(t => [t.name, t.name])), [adTypes]);
  const mediaIdOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    rows.forEach(row => byId.set(row.mediaId, row.mediaName));
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);
  const mediaScopedRows = mediaFilter ? rows.filter(row => row.mediaId === mediaFilter) : rows;
  const availableMediaAdOrderNames = Array.from(new Set(mediaScopedRows.map(row => row.mediaAdTypeCode).filter((c): c is string => !!c)));
  const mediaAdOrderOptions = availableMediaAdOrderNames.map(name => ({ id: name, name }));
  const mediaAdOrderScopedRows = orderFilter ? mediaScopedRows.filter(row => row.mediaAdTypeCode === orderFilter) : mediaScopedRows;
  const keyword = normalizeText(search);
  const visibleRows = mediaAdOrderScopedRows.filter(row => {
    if (statusFilter && row.status !== statusFilter) return false;
    if (!keyword) return true;
    const values = [
      row.mediaName,
      adTypeNameByName.get(row.adTypeCode ?? '') ?? row.adTypeCode,
      row.slot,
      row.type,
      row.rate,
      row.shareRatio,
      row.status
    ];
    return values.some(value => normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword));
  }).sort((a, b) => {
    if (sortState) {
      let delta = 0;
      switch (sortState.col) {
        case 'upstreamName':
          delta = displayName(a.upstreamName ?? '').localeCompare(displayName(b.upstreamName ?? ''), undefined, { sensitivity: 'base' });
          break;
        case 'adTypeCode':
          delta = (adTypeNameByName.get(a.adTypeCode ?? '') ?? a.adTypeCode ?? '').localeCompare(adTypeNameByName.get(b.adTypeCode ?? '') ?? b.adTypeCode ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'adSiteName':
          delta = displayName(a.adSiteName ?? '').localeCompare(displayName(b.adSiteName ?? ''), undefined, { sensitivity: 'base' });
          break;
        case 'downstreamName':
          delta = displayName(a.downstreamName ?? '').localeCompare(displayName(b.downstreamName ?? ''), undefined, { sensitivity: 'base' });
          break;
        case 'mediaAdTypeCode':
          delta = displayName(a.mediaAdTypeCode ?? '').localeCompare(displayName(b.mediaAdTypeCode ?? ''), undefined, { sensitivity: 'base' });
          break;
        case 'slot':
          delta = (a.slot ?? '').localeCompare(b.slot ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'shareRatio': {
          if (a.shareRatio == null && b.shareRatio != null) return sortState.dir === 'asc' ? 1 : -1;
          if (a.shareRatio != null && b.shareRatio == null) return sortState.dir === 'asc' ? -1 : 1;
          if (a.shareRatio != null && b.shareRatio != null) {
            const d = a.shareRatio - b.shareRatio;
            if (d !== 0) return sortState.dir === 'asc' ? d : -d;
          }
          break;
        }
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

  const mediaIdColumns: CsvColumn<MediaId>[] = [
    { label: t('media'), value: r => displayName(r.mediaName) },
    { label: t('mediaAdOrder'), value: r => displayName(adTypeNameByName.get(r.adTypeCode ?? '') ?? r.adTypeCode ?? '') },
    { label: t('mediaId'), value: r => r.slot ?? '' },
    { label: t('type'), value: r => r.type ?? '' },
    { label: t('rate'), value: r => formatMgmtRate(r.type, r.rate) },
    { label: t('shareRatio'), value: r => r.shareRatio ?? '-' },
    { label: t('status'), value: r => r.status ?? '' },
  ];

  const openCreate = () => {
    setEditing(null);
    setForm({
      advertiserId: '',
      adTypeId: '',
      adSiteId: '',
      downstreamId: '',
      mediaAdOrderId: '',
      mediaIdName: '',
      pctHal: '',
      customPrice: '',
      status: 'active',
    });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (record: MediaId) => {
    setEditing(record);
    const site = adSites.find(s => String(s.id) === String(record.adSiteId));
    const advId = site?.upstreamId ? String(site.upstreamId) : '';
    const adTypeId = adTypes.find(at => at.name === site?.adTypeCode)?.id ?? '';
    setForm({
      advertiserId: advId,
      adTypeId,
      adSiteId: String(record.adSiteId),
      downstreamId: String(record.downstreamId),
      mediaAdOrderId: record.mediaAdOrderId ?? '',
      mediaIdName: record.mediaIdName ?? '',
      pctHal: record.pctHal != null ? String(record.pctHal) : '',
      customPrice: record.rate != null ? String(record.rate) : '',
      status: record.status,
    });
    setFormError('');
    setFormOpen(true);
  };

  const openHardDelete = (row?: MediaId) => {
    if (row) setEditing(row);
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
  };

  const submitForm = async () => {
    if (!form.advertiserId) { setFormError(t('selectAdvertiser') || 'Vui lòng chọn Nhà quảng cáo'); return; }
    if (!form.adTypeId) { setFormError('Vui lòng chọn Đơn quảng cáo'); return; }
    if (!form.adSiteId) { setFormError('Vui lòng chọn ID quảng cáo'); return; }
    if (!form.downstreamId) { setFormError('Vui lòng chọn MEDIA'); return; }
    if (!form.mediaIdName.trim()) { setFormError('Vui lòng nhập ID MEDIA'); return; }

    setSaving(true);
    setFormError('');
    try {
      const basePayload: {
        adSiteId: string;
        customPrice?: number | null;
        pctHal?: number | null;
        mediaIdName?: string | null;
        mediaAdTypeId?: string | null;
      } = {
        adSiteId: form.adSiteId,
      };
      // Đơn QC MEDIA (dropdown 5) lưu qua mediaAdTypeId — lấy AdType của MediaAdOrder đã chọn.
      const selectedMao = mediaAdOrders.find(m => m.id === form.mediaAdOrderId);
      if (selectedMao) basePayload.mediaAdTypeId = selectedMao.adTypeId;
      const customPriceVal = form.customPrice.trim();
      if (customPriceVal) {
        const parsed = parseFloat(customPriceVal);
        if (Number.isFinite(parsed)) basePayload.customPrice = parsed;
        else basePayload.customPrice = null;
      }
      const pctHalVal = form.pctHal.trim();
      if (pctHalVal) {
        const parsed = parseFloat(pctHalVal);
        if (Number.isFinite(parsed)) basePayload.pctHal = parsed;
        else basePayload.pctHal = null;
      }
      if (form.mediaIdName.trim()) basePayload.mediaIdName = form.mediaIdName.trim();

      if (editing && editing.junctionId) {
        await updateMediaId(editing.junctionId, {
          mediaAdOrderId: form.mediaAdOrderId || null,
          customPrice: basePayload.customPrice ?? null,
          pctHal: basePayload.pctHal ?? null,
          mediaIdName: basePayload.mediaIdName ?? null,
          mediaAdTypeId: basePayload.mediaAdTypeId ?? null,
        });
        await loadRows();
      } else {
        const created = await createMediaId({ ...basePayload, downstreamId: form.downstreamId, mediaAdOrderId: form.mediaAdOrderId || null } as any);
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
    setSaving(true);
    setFormError('');
    try {
      if (canHardDelete) {
        try {
          const result = await hardDeleteMediaId(editing.junctionId);
          if (result.success) {
            setRows(prev => prev.filter(row => row.junctionId !== editing.junctionId));
            setFormOpen(false);
            return;
          }
        } catch {
          // fall through to soft delete
        }
      }
      await updateMediaId(String(editing.junctionId), { status: 'inactive' });
      await loadRows();
      setFormOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (record: MediaId, active: boolean) => {
    const nextStatus: EntityStatus = active ? 'active' : 'inactive';
    try {
      await updateMediaId(String(record.junctionId), { status: nextStatus });
      await loadRows();
    } catch (err) {
      setFormError(errorMessage(err));
    }
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
            <select className="filter-select" value={mediaFilter} onChange={e => { setMediaFilter(e.target.value); setOrderFilter(''); }}><option value="">{t('selectMedia')}</option>{mediaIdOptions.map(item => <option key={item.id} value={item.id}>{displayName(item.name)}</option>)}</select>
            <select className="filter-select" value={orderFilter} onChange={e => setOrderFilter(e.target.value)}><option value="">{t('selectMediaAdOrder')}</option>{mediaAdOrderOptions.map(item => <option key={item.id} value={item.name}>{displayName(item.name)}</option>)}</select>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">{t('allStatuses')}</option><option value="active">{t('online')}</option><option value="inactive">{t('offline')}</option></select>
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-outline" onClick={() => downloadCsv('media-ids.csv', mediaIdColumns, visibleRows)}>{t('export')}</button>
          </div>
        </div>
        {loading ? <LoadingState t={t} /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'upstreamName', label: t('advertiser'), render: r => displayName(r.upstreamName ?? '-'), sortDirection: sortState?.col === 'upstreamName' ? sortState.dir : null, onSortClick: () => toggleSort('upstreamName') },
              { key: 'adTypeCode', label: t('adType'), render: r => displayName(adTypeNameByName.get(r.adTypeCode ?? '') ?? r.adTypeCode ?? ''), sortDirection: sortState?.col === 'adTypeCode' ? sortState.dir : null, onSortClick: () => toggleSort('adTypeCode') },
              { key: 'adSiteName', label: t('adId'), render: r => displayName(r.adSiteName ?? '-'), sortDirection: sortState?.col === 'adSiteName' ? sortState.dir : null, onSortClick: () => toggleSort('adSiteName') },
              { key: 'downstreamName', label: t('media'), render: r => displayName(r.downstreamName ?? '-'), sortDirection: sortState?.col === 'downstreamName' ? sortState.dir : null, onSortClick: () => toggleSort('downstreamName') },
              { key: 'mediaAdTypeCode', label: t('mediaAdOrder'), render: r => displayName(r.mediaAdTypeCode ?? '-'), sortDirection: sortState?.col === 'mediaAdTypeCode' ? sortState.dir : null, onSortClick: () => toggleSort('mediaAdTypeCode') },
              { key: 'slot', label: t('mediaId'), sortDirection: sortState?.col === 'slot' ? sortState.dir : null, onSortClick: () => toggleSort('slot') },
              { key: 'shareRatio', label: t('shareRatio'), render: r => r.shareRatio != null ? `${r.shareRatio}` : '-', sortDirection: sortState?.col === 'shareRatio' ? sortState.dir : null, onSortClick: () => toggleSort('shareRatio') },
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
              <span className="modal-title">{editing ? t('editMediaId') : t('newMediaId')}</span>
              <button className="modal-close" onClick={() => setFormOpen(false)} disabled={saving}>x</button>
            </div>
            <div className="modal-body">
              {/* (1) Nhà quảng cáo */}
              <div className="form-group">
                <label>{t('advertiser') || 'Nhà quảng cáo'} <span style={{ color: 'red' }}>*</span></label>
                <select value={form.advertiserId} onChange={e => setForm(prev => ({ ...prev, advertiserId: e.target.value }))}>
                  <option value="">-</option>
                  {advertisers.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}
                </select>
              </div>
              {/* (2) Đơn quảng cáo — lọc theo upstream */}
              <div className="form-group">
                <label>Đơn quảng cáo <span style={{ color: 'red' }}>*</span></label>
                <select value={form.adTypeId} onChange={e => setForm(prev => ({ ...prev, adTypeId: e.target.value, adSiteId: '' }))} disabled={!form.advertiserId}>
                  <option value="">-</option>
                  {advertiserAdTypeOptions.map(at => <option key={at.id} value={at.id}>{displayName(at.name)}</option>)}
                </select>
              </div>
              {/* (3) ID quảng cáo (AdSite) — lọc theo upstream + adType */}
              <div className="form-group">
                <label>ID quảng cáo <span style={{ color: 'red' }}>*</span></label>
                <select value={form.adSiteId} onChange={e => setForm(prev => ({ ...prev, adSiteId: e.target.value }))} disabled={!form.adTypeId}>
                  <option value="">-</option>
                  {adSiteOptions.filter(s => !form.adTypeId || adTypes.find(at => at.id === form.adTypeId)?.name === s.adTypeCode).map(s => <option key={s.id} value={s.id}>{displayName(s.name)}</option>)}
                </select>
              </div>
              {/* (4) MEDIA — dropdown Downstream (loại hạ nguồn: ML/LE/YIYI) */}
              <div className="form-group">
                <label>MEDIA (Downstream) <span style={{ color: 'red' }}>*</span></label>
                <select value={form.downstreamId} onChange={e => setForm(prev => ({ ...prev, downstreamId: e.target.value }))} disabled={!form.adSiteId}>
                  <option value="">-</option>
                  {filteredDownstreamOptions.map(d => <option key={d.id} value={d.id}>{displayName(d.name)}</option>)}
                </select>
              </div>
              {/* (5) Đơn quảng cáo MEDIA — dropdown MediaAdOrder của cùng AdSite đã chọn */}
              <div className="form-group">
                <label>Đơn quảng cáo MEDIA</label>
                <select value={form.mediaAdOrderId} onChange={e => setForm(prev => ({ ...prev, mediaAdOrderId: e.target.value }))} disabled={!form.adSiteId}>
                  <option value="">-</option>
                  {filteredMediaAdOrderOptions.map(mao => <option key={mao.id} value={mao.id}>{displayName(mao.name)}</option>)}
                </select>
              </div>
              {/* (6) ID MEDIA (text input — người dùng tự đặt) */}
              <div className="form-group">
                <label>ID MEDIA <span style={{ color: 'red' }}>*</span></label>
                <input type="text" value={form.mediaIdName} onChange={e => setForm(prev => ({ ...prev, mediaIdName: e.target.value }))} placeholder="Nhập ID media..." />
              </div>
              {/* (7) Cột chia lợi nhuận từng link Ở hạ nguồn (pctHal) */}
              <div className="form-group">
                <label>Cột chia lợi nhuận từng link Ở hạ nguồn</label>
                <input type="number" step="0.01" min="0" max="1" value={form.pctHal} onChange={e => setForm(prev => ({ ...prev, pctHal: e.target.value }))} placeholder="0.8 (= 80%)" />
              </div>
              {/* (8) Đơn giá Ở hạ nguồn (customPrice) */}
              <div className="form-group">
                <label>Đơn giá Ở hạ nguồn</label>
                <input type="number" step="0.01" min="0" value={form.customPrice} onChange={e => setForm(prev => ({ ...prev, customPrice: e.target.value }))} placeholder={t('valuePlaceholder') || 'Nhập đơn giá...'} />
              </div>
              {editing && <div className="form-group"><label>{t('status')}</label>
                <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value as EntityStatus }))}>
                  <option value="active">{t('online')}</option>
                  <option value="inactive">{t('offline')}</option>
                </select>
              </div>}
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
      <HardDeleteModal
        open={hardDeleteOpen}
        entityName={editing?.slot ?? ''}
        loading={hardDeleteLoading}
        error={hardDeleteError}
        result={hardDeleteResult}
        onConfirm={handleHardDeleteConfirm}
        onClose={handleHardDeleteClose}
      />
    </div>
  );
}
