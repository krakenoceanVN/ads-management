import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import { Table, type SortDirection } from '../components/Table';
import { StatusToggle } from './Advertiser';
import { HardDeleteModal } from '../components/HardDeleteModal';
import {
  listAdTypes,
  createAdType,
  updateAdType,
  deleteAdType,
  hardDeleteAdType,
  getAdTypeDependencies,
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
  const [advertiserFilter, setAdvertiserFilter] = useState('');
  const [adOrderFilter, setAdOrderFilter] = useState('');
  const [editModal, setEditModal] = useState<EditState | null>(null);
  const [hasDeps, setHasDeps] = useState<boolean | null>(null);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [hardDeleteOpen, setHardDeleteOpen] = React.useState(false);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<AdType | null>(null);
  const [hardDeleteResult, setHardDeleteResult] = useState<HardDeleteResult | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = useState(false);
  const [hardDeleteError, setHardDeleteError] = useState('');
  const [sortState, setSortState] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const toggleSort = (col: string) => {
    setSortState(prev => {
      if (prev?.col === col) return prev.dir === 'asc' ? { col, dir: 'desc' } : null;
      return { col, dir: 'asc' };
    });
  };

  const canWrite = can('role.update');
  const canHardDelete = can('masterData.hardDelete');

  const advertisersById = useMemo(
    () => new Map(advertisers.map(a => [String(a.id), a])),
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

  const [statusFilter, setStatusFilter] = useState('');
  const sortedRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = rows.filter(r => {
      if (advertiserFilter && String(r.upstreamId ?? '') !== advertiserFilter) return false;
      if (adOrderFilter && r.id !== adOrderFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (!keyword) return true;
      const owner = r.upstreamId ? advertisersById.get(String(r.upstreamId))?.name : '';
      return (r.name ?? '').toLowerCase().includes(keyword)
        || (owner ?? '').toLowerCase().includes(keyword);
    });
    const out = [...filtered];
    out.sort((a, b) => {
      if (sortState) {
        let delta = 0;
        switch (sortState.col) {
          case 'name':
            delta = (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' });
            break;
          case 'adSiteCount':
            delta = (a.adSiteCount ?? 0) - (b.adSiteCount ?? 0);
            break;
          case 'upstreamName':
            delta = displayName(advertisersById.get(String(a.upstreamId ?? ''))?.name ?? '').localeCompare(displayName(advertisersById.get(String(b.upstreamId ?? ''))?.name ?? ''), undefined, { sensitivity: 'base' });
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
      return (a.id ?? '').localeCompare(b.id ?? '');
    });
    return out;
  }, [rows, search, advertiserFilter, adOrderFilter, statusFilter, sortState, advertisersById, displayName]);


  const openCreate = () => {
    setEditModal({ upstreamId: '', name: '', notes: '', status: 'active' });
    setEditError('');
  };

  const openEdit = (row: AdType) => {
    setHasDeps(null);
    getAdTypeDependencies(String(row.id))
      .then((deps: any) => {
        const total = Object.values(deps as Record<string, number>).reduce((s: number, v: number) => s + v, 0);
        setHasDeps(total > 0);
      })
      .catch(() => setHasDeps(false));
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

  const removeRecord = async () => {
    if (!editModal?.id) return;
    if (!window.confirm(t('confirmDelete'))) return;
    setSaving(true);
    setEditError('');
    try {
      if (canHardDelete && hasDeps === false) {
        const result = await hardDeleteAdType(editModal.id);
        if (result.success) {
          setRows(prev => prev.filter(r => r.id !== editModal.id));
          closeModal();
        } else {
          setEditError(result.message || 'Unexpected error');
        }
        return;
      }
      await deleteAdType(editModal.id);
      setRows(prev => prev.map(r => r.id === editModal.id ? { ...r, status: 'inactive' } : r));
      closeModal();
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setSaving(false);
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
              {editModal?.id !== undefined && (
                <button className="btn-danger" onClick={() => void removeRecord()} disabled={saving}>{t('delete')}</button>
              )}
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
              <select className="filter-select" value={advertiserFilter} onChange={e => setAdvertiserFilter(e.target.value)}>
                <option value="">{t('selectAdvertiser')}</option>
                {advertisers.map(a => <option key={a.id} value={String(a.id)}>{displayName(a.name)}</option>)}
              </select>
              <select className="filter-select" value={adOrderFilter} onChange={e => setAdOrderFilter(e.target.value)}>
                <option value="">{t('selectAdOrder')}</option>
                {rows.map(r => <option key={r.id} value={r.id}>{displayName(r.name)}</option>)}
              </select>
              <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">{t('allStatuses')}</option>
                <option value="active">{t('online')}</option>
                <option value="inactive">{t('offline')}</option>
              </select>
              <input className="search-input" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {error && <div className="form-error" style={{ margin: '8px 0' }}>{error}</div>}
          <Table
            columns={[
              { key: '__no__', label: t('no') },
              { key: 'upstreamName', label: t('advertiser'), render: r => r.upstreamName ?? '-', sortDirection: sortState?.col === 'upstreamName' ? sortState.dir : null, onSortClick: () => toggleSort('upstreamName') },
              { key: 'name', label: t('adType'), sortDirection: sortState?.col === 'name' ? sortState.dir : null, onSortClick: () => toggleSort('name') },
              { key: 'adSiteCount', label: t('linkCount'), render: r => r.adSiteCount ?? 0, sortDirection: sortState?.col === 'adSiteCount' ? sortState.dir : null, onSortClick: () => toggleSort('adSiteCount') },
              { key: 'notes', label: t('notes'), render: r => r.notes ?? '-', sortDirection: sortState?.col === 'notes' ? sortState.dir : null, onSortClick: () => toggleSort('notes') },
              { key: 'status', label: t('status'), render: r => <StatusToggle status={r.status === 'active'} onChange={active => updateStatus(r, active)} />, sortDirection: sortState?.col === 'status' ? sortState.dir : null, onSortClick: () => toggleSort('status') },
              { key: '__actions__', label: t('actions') },
            ]}
            data={sortedRows}
            emptyText={rows.length === 0 && !loading ? (t('noData') || '—') : undefined}
            onEdit={canWrite ? openEdit : undefined}
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