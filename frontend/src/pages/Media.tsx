import { StatusToggle } from './Advertiser';
import React from 'react';
import { useAppContext } from '../AppContext';
import { Table, TypeTag, type SortDirection } from '../components/Table';
import { QuarantineConfirmModal } from '../components/QuarantineConfirmModal';
import { useQuarantineAction } from '../hooks/useQuarantineAction';
import { HardDeleteModal } from '../components/HardDeleteModal';
import {
  createMedia,
  createMediaAdOrder,
  createMediaId,
  getMedia,
  hardDeleteMedia,
  hardDeleteMediaAdOrder,
  hardDeleteMediaId,
  listAdTypes,
  listAdvertisers,
  listDownstreams,
  listMedia,
  listMediaAdOrders,
  listMediaIds,
  updateMedia,
  updateMediaAdOrder,
  updateMediaId,
} from '../lib/bffApi';
import type { HardDeleteResult } from '../lib/bffApi';
import type {
  AdType,
  Advertiser,
  CreateMediaAdOrderInput,
  CreateMediaInput,
  DownstreamDto,
  EntityStatus,
  EntryType,
  Media,
  MediaAdOrder,
  MediaId,
  UpdateMediaAdOrderInput,
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
  downstreamId: string;
  adTypeId: string;
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
    downstreamId: '',
    adTypeId: '',
    name: '',
    notes: '',
    status: 'active',
  };
}

function adOrderFormFromRecord(record: MediaAdOrder): AdOrderFormState {
  return {
    downstreamId: record.downstreamId ?? '',
    adTypeId: record.adTypeId ?? '',
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

  const [nameSort, setNameSort] = React.useState<SortDirection>('asc');
  const [contactSort, setContactSort] = React.useState<SortDirection>('asc');
  const [phoneSort, setPhoneSort] = React.useState<SortDirection>('asc');
  const [emailSort, setEmailSort] = React.useState<SortDirection>('asc');
  const [notesSort, setNotesSort] = React.useState<SortDirection>('asc');
  const [statusSort, setStatusSort] = React.useState<SortDirection>('asc');
  const toggleNameSort = () => setNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleContactSort = () => setContactSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const togglePhoneSort = () => setPhoneSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleEmailSort = () => setEmailSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleNotesSort = () => setNotesSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleStatusSort = () => setStatusSort(prev => (prev === 'asc' ? 'desc' : 'asc'));

  const quarantine = useQuarantineAction({
    scope: 'media',
    targetId: String(editing?.id ?? ''),
    targetName: editing?.name ?? '',
  });

  const [hardDeleteOpen, setHardDeleteOpen] = React.useState(false);
  const [hardDeleteResult, setHardDeleteResult] = React.useState<HardDeleteResult | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = React.useState(false);
  const [hardDeleteError, setHardDeleteError] = React.useState('');

  const openHardDelete = (row?: Media) => {
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
  }).sort((a, b) => {
    const nameA = displayName(a.name);
    const nameB = displayName(b.name);
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
    const aActive = a.status === 'active' ? 1 : 0;
    const bActive = b.status === 'active' ? 1 : 0;
    const statusDelta = aActive - bActive;
    const statusOrder = statusSort === 'asc' ? statusDelta : -statusDelta;
    if (statusOrder !== 0) return statusOrder;
    return a.id - b.id;
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

  const removeRecord = (row?: Media) => {
    const target = row ?? editing;
    if (!target) return;
    if (!window.confirm(t('confirmDelete'))) return;
    setEditing(target);
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
              { key: 'name', label: t('media'), render: r => displayName(r.name), sortDirection: nameSort, onSortClick: toggleNameSort },
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
            onHardDelete={canHardDelete ? openHardDelete : undefined}
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
  const [mediaFilter, setMediaFilter] = React.useState('');
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
  const [nameSort, setNameSort] = React.useState<SortDirection>('asc');
  const [downstreamSort, setDownstreamSort] = React.useState<SortDirection>('asc');
  const [notesSort, setNotesSort] = React.useState<SortDirection>('asc');
  const [statusSort, setStatusSort] = React.useState<SortDirection>('asc');
  const { t, displayName, can } = useAppContext();
  const canHardDelete = can('masterData.hardDelete');
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
      setDownstreams((downstreamRows ?? []).filter(d => d.status === 'active'));
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
    if (mediaFilter && row.downstreamId !== mediaFilter) return false;
    if (!keyword) return true;
    const downstreamName = displayName(downstreamById.get(row.downstreamId)?.name ?? row.downstreamId);
    return [row.name, row.adTypeCode, row.notes, downstreamName].some(value =>
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
    const downA = a.downstreamId ?? '';
    const downB = b.downstreamId ?? '';
    const downDelta = downA.localeCompare(downB, undefined, { sensitivity: 'base' });
    const downOrder = downstreamSort === 'asc' ? downDelta : -downDelta;
    if (downOrder !== 0) return downOrder;
    const notesA = a.notes ?? '';
    const notesB = b.notes ?? '';
    const notesDelta = notesA.localeCompare(notesB, undefined, { sensitivity: 'base' });
    const notesOrder = notesSort === 'asc' ? notesDelta : -notesDelta;
    if (notesOrder !== 0) return notesOrder;
    return a.id.localeCompare(b.id);
  });

  const toggleNameSort = () => setNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleDownstreamSort = () => setDownstreamSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleNotesSort = () => setNotesSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleStatusSort = () => setStatusSort(prev => (prev === 'asc' ? 'desc' : 'asc'));

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
    { label: t('media'), value: r => displayName(downstreamById.get(r.downstreamId)?.name ?? '-') },
    { label: t('notes'), value: r => r.notes ?? '-' },
  ];

  const openCreate = () => {
    setEditing(null);
    setForm(defaultAdOrderForm());
    setFormError('');
    setFormOpen(true);
  };

  const removeRecord = async (row?: MediaAdOrder) => {
    const target = row ?? editing;
    if (!target) return;
    if (!window.confirm(t('confirmDelete'))) return;
    setEditing(target);
    try {
      await updateMediaAdOrder(target.id, { status: 'inactive' });
      await loadRows();
    } catch (err) {
      setFormError(errorMessage(err));
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
    if (!form.downstreamId || !form.adTypeId) {
      setFormError(t('requiredFields'));
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const trimmedName = form.name.trim();
      const payload: CreateMediaAdOrderInput = {
        downstreamId: form.downstreamId,
        adTypeId: form.adTypeId,
        name: trimmedName || null,
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
            <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-outline" onClick={() => downloadCsv('media-ad-orders.csv', mediaAdOrderColumns, visibleRows)}>{t('export')}</button>
          </div>
        </div>
        {loading ? <LoadingState t={t} /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'downstreamId', label: t('media'), render: r => displayName(downstreamById.get(r.downstreamId)?.name ?? '-'), sortDirection: downstreamSort, onSortClick: toggleDownstreamSort },
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
              { key: 'linkCount', label: t('linkCount'), render: r => r.linkCount ?? 0 },
              { key: 'notes', label: t('notes'), render: r => displayName(r.notes ?? '-'), sortDirection: notesSort, onSortClick: toggleNotesSort },
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
            onDelete={removeRecord}
            onHardDelete={canHardDelete ? openHardDelete : undefined}
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
              <div className="form-group"><label>{t('adType')}</label>
                <select value={form.adTypeId} onChange={e => setForm(prev => ({ ...prev, adTypeId: e.target.value }))}>
                  <option value="">-</option>
                  {adTypes.map(at => <option key={at.id} value={at.id}>{displayName(at.name)}</option>)}
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
  const [typeFilter, setTypeFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [nameSort, setNameSort] = React.useState<SortDirection>('asc');
  const [upstreamNameSort, setUpstreamNameSort] = React.useState<SortDirection>('asc');
  const [adTypeCodeSort, setAdTypeCodeSort] = React.useState<SortDirection>('asc');
  const [adSiteNameSort, setAdSiteNameSort] = React.useState<SortDirection>('asc');
  const [downstreamNameSort, setDownstreamNameSort] = React.useState<SortDirection>('asc');
  const [mediaAdTypeCodeSort, setMediaAdTypeCodeSort] = React.useState<SortDirection>('asc');
  const [slotSort, setSlotSort] = React.useState<SortDirection>('asc');
  const [shareRatioSort, setShareRatioSort] = React.useState<SortDirection>('asc');
  const [rateSort, setRateSort] = React.useState<SortDirection>('asc');
  const [notesSort, setNotesSort] = React.useState<SortDirection>('asc');
  const [statusSort, setStatusSort] = React.useState<SortDirection>('asc');
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

  // When advertiser changes: reset các field phụ thuộc
  React.useEffect(() => {
    if (!form.advertiserId) {
      setForm(prev => ({ ...prev, adTypeCode: '', adSiteId: '', downstreamId: '', mediaAdOrderId: '', mediaIdName: '', pctHal: '', customPrice: '' }));
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
    setTypeFilter('');
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
  const availableAdTypeNames = Array.from(new Set(mediaScopedRows.map(row => row.adTypeCode).filter((c): c is string => !!c)));
  const adTypeOptions = adTypes.filter(t => availableAdTypeNames.includes(t.name));
  const adTypeScopedRows = orderFilter ? mediaScopedRows.filter(row => row.adTypeCode === orderFilter) : mediaScopedRows;
  const typeOptions = Array.from(new Set(adTypeScopedRows.map(row => row.type).filter(Boolean)));
  const keyword = normalizeText(search);
  const visibleRows = adTypeScopedRows.filter(row => {
    if (typeFilter && row.type !== typeFilter) return false;
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
    const aActive = a.status === 'active' ? 1 : 0;
    const bActive = b.status === 'active' ? 1 : 0;
    const statusDelta = aActive - bActive;
    const statusOrder = statusSort === 'asc' ? statusDelta : -statusDelta;
    if (statusOrder !== 0) return statusOrder;
    const upA = displayName(a.upstreamName ?? '');
    const upB = displayName(b.upstreamName ?? '');
    const upDelta = upA.localeCompare(upB, undefined, { sensitivity: 'base' });
    const upOrder = upstreamNameSort === 'asc' ? upDelta : -upDelta;
    if (upOrder !== 0) return upOrder;
    const adTypeA = adTypeNameByName.get(a.adTypeCode ?? '') ?? a.adTypeCode ?? '';
    const adTypeB = adTypeNameByName.get(b.adTypeCode ?? '') ?? b.adTypeCode ?? '';
    const adTypeDelta = adTypeA.localeCompare(adTypeB, undefined, { sensitivity: 'base' });
    const adTypeOrder = adTypeCodeSort === 'asc' ? adTypeDelta : -adTypeDelta;
    if (adTypeOrder !== 0) return adTypeOrder;
    const adSiteA = displayName(a.adSiteName ?? '');
    const adSiteB = displayName(b.adSiteName ?? '');
    const adSiteDelta = adSiteA.localeCompare(adSiteB, undefined, { sensitivity: 'base' });
    const adSiteOrder = adSiteNameSort === 'asc' ? adSiteDelta : -adSiteDelta;
    if (adSiteOrder !== 0) return adSiteOrder;
    const downA = displayName(a.downstreamName ?? '');
    const downB = displayName(b.downstreamName ?? '');
    const downDelta = downA.localeCompare(downB, undefined, { sensitivity: 'base' });
    const downOrder = downstreamNameSort === 'asc' ? downDelta : -downDelta;
    if (downOrder !== 0) return downOrder;
    const maA = displayName(a.mediaAdTypeCode ?? '');
    const maB = displayName(b.mediaAdTypeCode ?? '');
    const maDelta = maA.localeCompare(maB, undefined, { sensitivity: 'base' });
    const maOrder = mediaAdTypeCodeSort === 'asc' ? maDelta : -maDelta;
    if (maOrder !== 0) return maOrder;
    const slotA = a.slot ?? '';
    const slotB = b.slot ?? '';
    const slotDelta = slotA.localeCompare(slotB, undefined, { sensitivity: 'base' });
    const slotOrder = slotSort === 'asc' ? slotDelta : -slotDelta;
    if (slotOrder !== 0) return slotOrder;
    const srA = a.shareRatio;
    const srB = b.shareRatio;
    if (srA == null && srB != null) return shareRatioSort === 'asc' ? 1 : -1;
    if (srA != null && srB == null) return shareRatioSort === 'asc' ? -1 : 1;
    if (srA != null && srB != null) {
      const srDelta = srA - srB;
      const srOrder = shareRatioSort === 'asc' ? srDelta : -srDelta;
      if (srOrder !== 0) return srOrder;
    }
    const rA = a.rate;
    const rB = b.rate;
    if (rA == null && rB != null) return rateSort === 'asc' ? 1 : -1;
    if (rA != null && rB == null) return rateSort === 'asc' ? -1 : 1;
    if (rA != null && rB != null) {
      const rDelta = rA - rB;
      const rOrder = rateSort === 'asc' ? rDelta : -rDelta;
      if (rOrder !== 0) return rOrder;
    }
    const notesA = a.notes ?? '';
    const notesB = b.notes ?? '';
    const notesDelta = notesA.localeCompare(notesB, undefined, { sensitivity: 'base' });
    const notesOrder = notesSort === 'asc' ? notesDelta : -notesDelta;
    if (notesOrder !== 0) return notesOrder;
    return String(a.id).localeCompare(String(b.id));
  });

  const toggleNameSort = () => setNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleUpstreamNameSort = () => setUpstreamNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleAdTypeCodeSort = () => setAdTypeCodeSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleAdSiteNameSort = () => setAdSiteNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleDownstreamNameSort = () => setDownstreamNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleMediaAdTypeCodeSort = () => setMediaAdTypeCodeSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleSlotSort = () => setSlotSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleShareRatioSort = () => setShareRatioSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleRateSort = () => setRateSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleNotesSort = () => setNotesSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleStatusSort = () => setStatusSort(prev => (prev === 'asc' ? 'desc' : 'asc'));

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
      mediaAdOrderId: '',
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
      } = {
        adSiteId: form.adSiteId,
      };
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
          customPrice: basePayload.customPrice ?? null,
          pctHal: basePayload.pctHal ?? null,
          mediaIdName: basePayload.mediaIdName ?? null,
        });
        await loadRows();
      } else {
        const created = await createMediaId({ ...basePayload, downstreamId: form.downstreamId } as any);
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

  const removeRecord = async (row?: MediaId) => {
    const target = row ?? editing;
    if (!target || !target.junctionId) return;
    if (!window.confirm(t('confirmDelete'))) return;
    setEditing(target);
    try {
      await updateMediaId(String(target.junctionId), { status: 'inactive' });
      await loadRows();
    } catch (err) {
      setFormError(errorMessage(err));
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
            <select className="filter-select" value={mediaFilter} onChange={e => { setMediaFilter(e.target.value); setOrderFilter(''); setTypeFilter(''); }}><option value="">{t('selectMedia')}</option>{mediaIdOptions.map(item => <option key={item.id} value={item.id}>{displayName(item.name)}</option>)}</select>
            <select className="filter-select" value={orderFilter} onChange={e => { setOrderFilter(e.target.value); setTypeFilter(''); }}><option value="">{t('selectMediaAdOrder')}</option>{adTypeOptions.map(t => <option key={t.id} value={t.name}>{displayName(t.name)}</option>)}</select>
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
              { key: 'upstreamName', label: t('advertiser'), render: r => displayName(r.upstreamName ?? '-'), sortDirection: upstreamNameSort, onSortClick: toggleUpstreamNameSort },
              { key: 'adTypeCode', label: t('adType'), render: r => displayName(adTypeNameByName.get(r.adTypeCode ?? '') ?? r.adTypeCode ?? ''), sortDirection: adTypeCodeSort, onSortClick: toggleAdTypeCodeSort },
              { key: 'adSiteName', label: t('adId'), render: r => displayName(r.adSiteName ?? '-'), sortDirection: adSiteNameSort, onSortClick: toggleAdSiteNameSort },
              { key: 'downstreamName', label: t('media'), render: r => displayName(r.downstreamName ?? '-'), sortDirection: downstreamNameSort, onSortClick: toggleDownstreamNameSort },
              { key: 'mediaAdTypeCode', label: t('mediaAdOrder'), render: r => displayName(r.mediaAdTypeCode ?? '-'), sortDirection: mediaAdTypeCodeSort, onSortClick: toggleMediaAdTypeCodeSort },
              { key: 'slot', label: t('mediaId'), sortDirection: slotSort, onSortClick: toggleSlotSort },
              { key: 'shareRatio', label: t('shareRatio'), render: r => r.shareRatio != null ? `${r.shareRatio}` : '-', sortDirection: shareRatioSort, onSortClick: toggleShareRatioSort },
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
