import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import { Table, type SortDirection } from '../components/Table';
import { StatusToggle } from './Advertiser';
import { HardDeleteModal } from '../components/HardDeleteModal';
import {
  listAdTypes,
  createAdType,
  updateAdType,
  hardDeleteAdType,
  listAdvertisers,
} from '../lib/bffApi';
import type { AdType, Advertiser, EntityStatus } from '../lib/bffTypes';
import type { HardDeleteResult } from '../lib/bffApi';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Request failed');
}

interface EditState {
  id?: string;
  upstreamId: string;
  name: string;
  notes: string;
  status: EntityStatus;
}

export function AdTypeMgmt() {
  const { t, displayName, can } = useAppContext();
  const [rows, setRows] = useState<AdType[]>([]);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editModal, setEditModal] = useState<EditState | null>(null);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [hardDeleteOpen, setHardDeleteOpen] = React.useState(false);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<AdType | null>(null);
  const [hardDeleteResult, setHardDeleteResult] = useState<HardDeleteResult | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = useState(false);
  const [hardDeleteError, setHardDeleteError] = useState('');
  const [nameSort, setNameSort] = useState<SortDirection>('asc');
  const [linkCountSort, setLinkCountSort] = useState<SortDirection>('desc');
  const [upstreamSort, setUpstreamSort] = useState<SortDirection>('asc');
  const [notesSort, setNotesSort] = useState<SortDirection>('asc');
  const [statusSort, setStatusSort] = useState<SortDirection>('asc');

  const canWrite = can('role.update');
  const canHardDelete = can('masterData.hardDelete');

  const advertisersById = useMemo(
    () => new Map(advertisers.map(a => [a.id, a])),
    [advertisers]
  );

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [adTypeRows, advertiserRows] = await Promise.all([listAdTypes(), listAdvertisers()]);
      setRows(adTypeRows ?? []);
      setAdvertisers(advertiserRows ?? []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const sortedRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = keyword
      ? rows.filter(r => {
          const owner = r.upstreamId ? advertisersById.get(Number(r.upstreamId))?.name : '';
          return (r.name ?? '').toLowerCase().includes(keyword)
            || (owner ?? '').toLowerCase().includes(keyword);
        })
      : rows;
    const out = [...filtered];
    out.sort((a, b) => {
      const nameA = a.name ?? '';
      const nameB = b.name ?? '';
      const nameDelta = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      const nameOrder = nameSort === 'asc' ? nameDelta : -nameDelta;
      if (nameOrder !== 0) return nameOrder;
      const countA = a.adSiteCount ?? 0;
      const countB = b.adSiteCount ?? 0;
      const countDelta = countA - countB;
      const countOrder = linkCountSort === 'asc' ? countDelta : -countDelta;
      if (countOrder !== 0) return countOrder;
      const ownerA = displayName(advertisersById.get(Number(a.upstreamId))?.name ?? '');
      const ownerB = displayName(advertisersById.get(Number(b.upstreamId))?.name ?? '');
      const ownerDelta = ownerA.localeCompare(ownerB, undefined, { sensitivity: 'base' });
      const ownerOrder = upstreamSort === 'asc' ? ownerDelta : -ownerDelta;
      if (ownerOrder !== 0) return ownerOrder;
      const notesA = a.notes ?? '';
      const notesB = b.notes ?? '';
      const notesDelta = notesA.localeCompare(notesB, undefined, { sensitivity: 'base' });
      const notesOrder = notesSort === 'asc' ? notesDelta : -notesDelta;
      if (notesOrder !== 0) return notesOrder;
      return (a.id ?? '').localeCompare(b.id ?? '');
    });
    return out;
  }, [rows, search, nameSort, linkCountSort, upstreamSort, notesSort, advertisersById, displayName]);

  const toggleNameSort = () => setNameSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleLinkCountSort = () => setLinkCountSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleUpstreamSort = () => setUpstreamSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleNotesSort = () => setNotesSort(prev => (prev === 'asc' ? 'desc' : 'asc'));
  const toggleStatusSort = () => setStatusSort(prev => (prev === 'asc' ? 'desc' : 'asc'));

  const openCreate = () => {
    setEditModal({ upstreamId: '', name: '', notes: '', status: 'active' });
    setEditError('');
  };

  const openEdit = (row: AdType) => {
    setEditModal({
      id: row.id,
      upstreamId: row.upstreamId ?? '',
      name: row.name,
      notes: row.notes ?? '',
      status: (row.status as EntityStatus) ?? 'active',
    });
    setEditError('');
  };

  const closeModal = () => {
    setEditModal(null);
    setEditError('');
  };

  const handleSave = async () => {
    if (!editModal) return;
    const { name, notes, upstreamId, status } = editModal;
    if (!upstreamId) { setEditError(t('selectUpstreamRequired')); return; }
    if (!name.trim()) { setEditError(t('adTypeNameRequired')); return; }

    setSaving(true);
    setEditError('');
    try {
      if (editModal.id !== undefined) {
        await updateAdType(editModal.id, {
          name: name.trim(),
          upstreamId: upstreamId || null,
          notes: notes.trim() || null,
          status,
        });
      } else {
        await createAdType({
          name: name.trim(),
          upstreamId: upstreamId || undefined,
          notes: notes.trim() || undefined,
          status,
        });
      }
      setEditModal(null);
      await loadRows();
    } catch (err: any) {
      setEditError(err?.message || errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openHardDelete = (row: AdType) => {
    setHardDeleteTarget(row);
    setHardDeleteResult(null);
    setHardDeleteError('');
    setHardDeleteOpen(true);
  };

  const updateStatus = async (record: AdType, active: boolean) => {
    const nextStatus: EntityStatus = active ? 'active' : 'inactive';
    try {
      await updateAdType(record.id, { status: nextStatus });
      setRows(prev => prev.map(r => r.id === record.id ? { ...r, status: nextStatus } : r));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleHardDeleteConfirm = async () => {
    if (!hardDeleteTarget) return;
    setHardDeleteLoading(true);
    setHardDeleteError('');
    try {
      const result = await hardDeleteAdType(hardDeleteTarget.id);
      setHardDeleteResult(result);
      if (result.success) {
        setRows(prev => prev.filter(r => r.id !== hardDeleteTarget.id));
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

  return (
    <>
      {editModal && (
        <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                {editModal.id !== undefined ? t('editAdType') : t('newAdType')}
              </span>
              <button className="modal-close" onClick={closeModal} disabled={saving}>x</button>
            </div>
            <div className="modal-body">
              {editError && <div className="form-error" style={{ marginBottom: '8px' }}>{editError}</div>}
              <div className="form-group">
                <label>{t('advertiser')} <span style={{ color: 'red' }}>*</span></label>
                <select
                  className="input"
                  value={editModal.upstreamId}
                  onChange={e => setEditModal(prev => prev ? { ...prev, upstreamId: e.target.value } : prev)}
                  disabled={saving}
                >
                  <option value="">-</option>
                  {advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>{t('adType')} <span style={{ color: 'red' }}>*</span></label>
                <input
                  className="input"
                  type="text"
                  value={editModal.name}
                  placeholder="e.g. Google Ads"
                  maxLength={50}
                  onChange={e => setEditModal(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <label>{t('notes')}</label>
                <textarea
                  className="input"
                  value={editModal.notes}
                  maxLength={200}
                  rows={3}
                  onChange={e => setEditModal(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <label>{t('status')}</label>
                <select
                  className="input"
                  value={editModal.status}
                  onChange={e => setEditModal(prev => prev ? { ...prev, status: e.target.value as EntityStatus } : prev)}
                  disabled={saving}
                >
                  <option value="active">{t('online')}</option>
                  <option value="inactive">{t('offline')}</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={closeModal} disabled={saving}>{t('cancel')}</button>
              <button className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? '...' : t('saveSystem')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page active">
        <div className="page-header">
          <h1 className="page-title">{t('pAdTypeMgmt')}</h1>
        </div>
        <div className="card">
          <div className="toolbar">
            <div className="toolbar-left">
              {canWrite && (
                <button className="btn-primary" onClick={openCreate}>{t('newAdType')}</button>
              )}
            </div>
            <div className="toolbar-right">
              <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {error && <div className="form-error" style={{ margin: '8px 0' }}>{error}</div>}
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'upstreamName', label: t('advertiser'), render: r => r.upstreamName ?? '-', sortDirection: upstreamSort, onSortClick: toggleUpstreamSort },
              { key: 'name', label: t('adTypeNameLabel'), sortDirection: nameSort, onSortClick: toggleNameSort },
              { key: 'adSiteCount', label: t('linkCount'), render: r => r.adSiteCount ?? 0, sortDirection: linkCountSort, onSortClick: toggleLinkCountSort },
              { key: 'notes', label: t('notes'), render: r => r.notes ?? '-', sortDirection: notesSort, onSortClick: toggleNotesSort },
              { key: 'status', label: t('status'), render: r => <StatusToggle status={r.status === 'active'} onChange={active => updateStatus(r, active)} />, sortDirection: statusSort, onSortClick: toggleStatusSort },
              { key: '__actions__', label: t('actions') },
            ]}
            data={sortedRows}
            emptyText={rows.length === 0 && !loading ? (t('noData') || '—') : undefined}
            onEdit={canWrite ? openEdit : undefined}
            onHardDelete={canHardDelete ? openHardDelete : undefined}
          />
        </div>
      </div>
      <HardDeleteModal
        open={hardDeleteOpen}
        entityName={hardDeleteTarget?.name ?? ''}
        loading={hardDeleteLoading}
        error={hardDeleteError}
        result={hardDeleteResult}
        onConfirm={handleHardDeleteConfirm}
        onClose={handleHardDeleteClose}
      />
    </>
  );
}