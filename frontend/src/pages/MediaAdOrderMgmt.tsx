import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import { Table, type SortDirection } from '../components/Table';
import { StatusToggle } from './Advertiser';
import { QuarantineConfirmModal } from '../components/QuarantineConfirmModal';
import { useQuarantineAction } from '../hooks/useQuarantineAction';
import {
  listMediaAdOrders,
  createMediaAdOrder,
  updateMediaAdOrder,
  deleteMediaAdOrder,
  listDownstreams,
  listAdTypes,
} from '../lib/bffApi';
import type { AdType, DownstreamDto, MediaAdOrder, EntityStatus } from '../lib/bffTypes';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Request failed');
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

type AdOrderFormState = {
  downstreamId: string;
  adTypeId: string;
  name: string;
  notes: string;
  status: EntityStatus;
};

function defaultForm(): AdOrderFormState {
  return { downstreamId: '', adTypeId: '', name: '', notes: '', status: 'active' };
}

function formFromRecord(r: MediaAdOrder): AdOrderFormState {
  return {
    downstreamId: r.downstreamId,
    adTypeId: r.adTypeId,
    name: r.name ?? '',
    notes: r.notes ?? '',
    status: r.status,
  };
}

export function MediaAdOrderMgmt() {
  const { t, displayName } = useAppContext();
  const [rows, setRows] = useState<MediaAdOrder[]>([]);
  const [downstreamList, setDownstreamList] = useState<DownstreamDto[]>([]);
  const [adTypes, setAdTypes] = useState<AdType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<MediaAdOrder | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const downstreamById = React.useMemo(
    () => new Map(downstreamList.map(d => [String(d.id), d])),
    [downstreamList]
  );
  const [form, setForm] = useState<AdOrderFormState>(defaultForm());
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [mediaFilter, setMediaFilter] = useState('');
  const [nameSort, setNameSort] = useState<SortDirection>('asc');
  const [statusSort, setStatusSort] = useState<SortDirection>('asc');

  const quarantine = useQuarantineAction({
    scope: 'media',
    targetId: editing?.id ?? '',
    targetName: downstreamById.get(editing?.downstreamId ?? '')?.name ?? '',
  });

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orders, downstreamRows, adTypeRows] = await Promise.all([
        listMediaAdOrders(),
        listDownstreams(),
        listAdTypes(),
      ]);
      setRows(orders);
      setDownstreamList((downstreamRows ?? []).filter(d => d.status === 'active'));
      setAdTypes(adTypeRows);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const adTypeNameById = useMemo(
    () => new Map(adTypes.map(at => [at.id, at.name])),
    [adTypes]
  );

  const mediaNameById = useMemo(
    () => new Map(downstreamList.map(d => [String(d.id), d.name ?? d.downstreamType])),
    [downstreamList]
  );

  const keyword = normalizeText(search);
  const visibleRows = useMemo(() => {
    const filtered = rows.filter(r => {
      if (mediaFilter && r.downstreamId !== mediaFilter) return false;
      if (!keyword) return true;
      return [r.name, r.adTypeName, r.adTypeCode, r.notes, r.status].some(value =>
        normalizeText(value).includes(keyword) || normalizeText(displayName(String(value ?? ''))).includes(keyword)
      );
    });
    return [...filtered].sort((a, b) => {
      const aActive = a.status === 'active' ? 1 : 0;
      const bActive = b.status === 'active' ? 1 : 0;
      const statusDelta = aActive - bActive;
      const statusOrder = statusSort === 'asc' ? statusDelta : -statusDelta;
      if (statusOrder !== 0) return statusOrder;
      const nameDelta = (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' });
      const nameOrder = nameSort === 'asc' ? nameDelta : -nameDelta;
      if (nameOrder !== 0) return nameOrder;
      return a.id.localeCompare(b.id);
    });
  }, [rows, mediaFilter, keyword, statusSort, nameSort, displayName]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm(), downstreamId: mediaFilter || '' });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (record: MediaAdOrder) => {
    setEditing(record);
    setForm(formFromRecord(record));
    setFormError('');
    setFormOpen(true);
  };

  const closeModal = () => {
    setFormOpen(false);
    setEditing(null);
    setFormError('');
  };

  const handleSave = async () => {
    if (!form.downstreamId) { setFormError(t('selectMedia') || 'Vui lòng chọn Media'); return; }
    if (!form.adTypeId) { setFormError(t('adTypeRequired') || 'Vui lòng chọn AdType'); return; }

    setSaving(true);
    setFormError('');
    try {
      const payload = {
        downstreamId: form.downstreamId,
        adTypeId: form.adTypeId,
        name: form.name.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      };

      if (editing) {
        await updateMediaAdOrder(editing.id, payload);
      } else {
        await createMediaAdOrder(payload);
      }
      setFormOpen(false);
      setEditing(null);
      await loadRows();
    } catch (err: unknown) {
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

  const toggleNameSort = () => setNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleStatusSort = () => setStatusSort(prev => (prev === 'asc' ? 'desc' : 'asc'));

  return (
    <>
      <div className="page active">
        <div className="page-header">
          <h1 className="page-title">{t('pMediaAdOrderMgmt')}</h1>
        </div>
        <div className="card">
          <div className="toolbar">
            <div className="toolbar-left">
              <button className="btn-primary" onClick={openCreate}>{t('newMediaAdOrder')}</button>
            </div>
            <div className="toolbar-right">
              <select className="filter-select" value={mediaFilter} onChange={e => setMediaFilter(e.target.value)}>
                <option value="">{t('selectMedia')}</option>
                {downstreamList.map(item => <option key={item.id} value={String(item.id)}>{displayName(item.name ?? item.downstreamType)}</option>)}
              </select>
              <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {loading ? <LoadingState t={t} /> : error ? <ErrorState message={error} onRetry={loadRows} /> : (
            <Table
              columns={[
                { key: '__no__', label: t('no') },
                { key: 'downstreamId', label: t('media'), render: r => displayName(downstreamById.get(r.downstreamId)?.name ?? '-') },
                { key: 'name', label: t('mediaAdOrder'), render: r => displayName(r.name), sortDirection: nameSort, onSortClick: toggleNameSort },
                { key: 'notes', label: t('notes'), render: r => displayName(r.notes ?? '-') },
                {
                  key: 'status',
                  label: t('status'),
                  render: r => <StatusToggle status={r.status === 'active'} onChange={() => {/* soft toggle via edit */}} />,
                  sortDirection: statusSort, onSortClick: toggleStatusSort,
                },
                { key: '__actions__', label: t('actions') },
              ]}
              data={visibleRows}
              onEdit={openEdit}
            />
          )}
        </div>
      </div>
      {formOpen && (
        <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget && !saving) closeModal(); }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing ? t('editMediaAdOrder') : t('newMediaAdOrder')}</span>
              <button className="modal-close" onClick={closeModal} disabled={saving}>x</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t('selectMedia')} <span style={{ color: 'red' }}>*</span></label>
                <select value={form.downstreamId} onChange={e => setForm(prev => ({ ...prev, downstreamId: e.target.value }))}>
                  <option value="">-</option>
                  {downstreamList.map(item => <option key={item.id} value={String(item.id)}>{displayName(item.name ?? item.downstreamType)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>{t('adType')} <span style={{ color: 'red' }}>*</span></label>
                <select value={form.adTypeId} onChange={e => setForm(prev => ({ ...prev, adTypeId: e.target.value }))}>
                  <option value="">-</option>
                  {adTypes.map(at => <option key={at.id} value={at.id}>{displayName(at.name)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>{t('mediaAdOrderName')}</label>
                <input
                  type="text"
                  value={form.name}
                  placeholder={t('autoGenNameHint') || 'Để trống sẽ tự sinh tên theo AdType'}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>{t('notes')}</label>
                <input type="text" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('status')}</label>
                <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value as EntityStatus }))}>
                  <option value="active">{t('online')}</option>
                  <option value="inactive">{t('offline')}</option>
                </select>
              </div>
              {formError && <div className="form-error">{formError}</div>}
            </div>
            <div className="modal-footer">
              {editing && <button className="btn-danger" onClick={removeRecord} disabled={saving}>{t('delete')}</button>}
              <button className="btn-outline" onClick={closeModal} disabled={saving}>{t('cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('submit')}</button>
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
    </>
  );
}