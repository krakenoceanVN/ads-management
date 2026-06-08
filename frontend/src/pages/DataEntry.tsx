import React, { useMemo, useState, useCallback } from 'react';
import { useAppContext } from '../AppContext';
import { DatePickerInput } from '../components/DatePickerInput';
import {
  confirmAdvertiserEntryBatch,
  confirmMediaEntryBatch,
  listAdOrders,
  listAdvertiserEntries,
  listMediaEntries,
  saveAdvertiserEntryBatch,
  saveMediaEntryBatch,
  unconfirmAdvertiserEntry,
  unconfirmMediaEntry,
} from '../lib/bffApi';
import type { AdOrder, AdvertiserEntryRow, DataEntryStatus, EntryType, MediaEntryRow } from '../lib/bffTypes';
import { normalizeDate, sortRowsByDate } from '../lib/date';

function csvEscape(value: string | number) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, header: string[], body: string[][]) {
  const csv = [header.map(c => csvEscape(c)).join(','), ...body.map(row => row.map(c => csvEscape(c)).join(','))].join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type EntryFilters = {
  startDate: string;
  endDate: string;
  first: string;
  second: string;
  third: string;
  status: string;
  search: string;
};

const emptyFilters: EntryFilters = { startDate: todayString(), endDate: '', first: '', second: '', third: '', status: '', search: '' };

function todayString() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function hasValue(val: unknown) {
  return val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '—';
}

function formatAmount(val: unknown) {
  if (!hasValue(val)) return '';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return Number.isInteger(n) ? n.toString() : Number(n.toFixed(3)).toString();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Request failed');
}

function isAllowedEntryType(type: unknown): type is EntryType {
  return type === 'CPM' || type === 'CPS' || type === 'CPA';
}

function isNeutralDataCoefficient(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return true;
  const normalized = raw.replace(/%/g, '').trim();
  return normalized === '1' || normalized === '100';
}

function formatBatchErrors(errors: unknown[]) {
  return errors.map(item => typeof item === 'string' ? item : String((item as { message?: unknown })?.message ?? item)).join('; ');
}

function datesBetween(startDate: string, endDate: string) {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate || startDate);
  if (!start && !end) return [];
  const fromDate = new Date(start || end);
  const toDate = new Date(end || start);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return [];
  const [first, last] = fromDate <= toDate ? [fromDate, toDate] : [toDate, fromDate];
  const dates: string[] = [];
  const cursor = new Date(first);
  while (cursor <= last) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function updateFilter(setter: React.Dispatch<React.SetStateAction<EntryFilters>>, key: keyof EntryFilters, value: string) {
  setter(prev => ({ ...prev, [key]: value }));
}

function matchesStatusFilter(rowStatus: string | undefined, filterStatus: string) {
  if (!filterStatus) return true;
  if (filterStatus === 'confirmed') return rowStatus === 'confirmed';
  return rowStatus !== 'confirmed';
}

function dateRangeLabel(filters: EntryFilters, fallback: string) {
  if (filters.startDate && filters.endDate) return `${filters.startDate} - ${filters.endDate}`;
  return filters.startDate || filters.endDate || fallback;
}

function matchesEntryDateRange(rowDate: string, startDate: string, endDate: string) {
  const normalized = normalizeDate(rowDate);
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (!start && !end) return true;
  if (start && end) {
    const [from, to] = start <= end ? [start, end] : [end, start];
    return normalized >= from && normalized <= to;
  }
  return normalized === (start || end);
}

function ConfirmButton({ confirmed, onClick }: { confirmed?: boolean; onClick: () => void }) {
  const { t } = useAppContext();
  return (
    <button className={`entry-confirm-btn ${confirmed ? 'confirmed' : ''}`} onClick={onClick} disabled={confirmed} type="button">
      {confirmed ? t('confirmed') : t('confirmData')}
    </button>
  );
}

export function AiEntry() {
  const { t } = useAppContext();

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pAiEntry')}</h1></div>
      <div className="card">
        <div className="empty-state" style={{ padding: '60px 20px' }}>
          <div className="empty-state-icon">🔒</div>
          <div className="empty-state-text">Feature locked</div>
          <div style={{ color: 'var(--text-sub)', fontSize: '13px', marginTop: '8px' }}>
            This feature is not yet available.
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdvEntry() {
  const { t, displayName } = useAppContext();
  const [filters, setFilters] = useState<EntryFilters>(emptyFilters);
  const [rows, setRows] = useState<AdvertiserEntryRow[]>([]);
  const [adOrders, setAdOrders] = useState<AdOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const draftRowsRef = React.useRef(new Map<string, Pick<AdvertiserEntryRow, 'rate' | 'traffic' | 'settlement'>>());

  const draftKeyForRow = (row: AdvertiserEntryRow) => `${row.adIdNum}:${normalizeDate(row.date) ?? row.date}`;

  const clearDrafts = (targetRows: AdvertiserEntryRow[]) => {
    targetRows.forEach(row => draftRowsRef.current.delete(draftKeyForRow(row)));
  };

  const mergeAdvertiserDrafts = React.useCallback((serverRows: AdvertiserEntryRow[]) => serverRows.map(row => {
    const draft = draftRowsRef.current.get(draftKeyForRow(row));
    return draft && row.status !== 'confirmed'
      ? { ...row, ...draft, status: 'pending' as DataEntryStatus }
      : row;
  }), []);

  const loadRows = React.useCallback(async () => {
    const date = normalizeDate(filters.startDate);
    if (!date) return;
    setLoading(true);
    setError('');
    try {
      const [orders, dateRows] = await Promise.all([
        listAdOrders(),
        listAdvertiserEntries({ date }),
      ]);
      setAdOrders(orders);
      const nextRows = (Array.isArray(dateRows) ? dateRows : []).filter(row => isAllowedEntryType(row.type));
      setRows(mergeAdvertiserDrafts(nextRows));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, mergeAdvertiserDrafts]);

  React.useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const scopedRows = useMemo(() => rows.filter(row => row.date === normalizeDate(filters.startDate)), [rows, filters.startDate]);

  const filteredRows = useMemo(() => scopedRows.filter(row => {
    const keyword = filters.search.trim().toLowerCase();
    return (!filters.first || row.advertiser === filters.first)
      && (!filters.second || (row.adOrderCode ?? row.adOrder) === filters.second)
      && (!filters.third || row.adId === filters.third)
      && matchesStatusFilter(row.status, filters.status)
      && (!keyword || [row.advertiser, row.adOrder, row.adId, row.type, displayName(row.advertiser), displayName(row.adOrder)].some(item => String(item ?? '').toLowerCase().includes(keyword)));
  }), [scopedRows, filters, displayName]);

  const visibleRows = useMemo(
    () => sortRowsByDate(filteredRows.length ? filteredRows : scopedRows, ['advertiser', 'adOrder', 'adId']),
    [filteredRows, scopedRows]
  );
  const adOrderOptions = uniqueOptions(scopedRows.map(row => row.adOrderCode ?? row.adOrder).filter(Boolean));
  const advertiserOptions = uniqueOptions(scopedRows.map(row => row.advertiser));
  const filteredByAdvertiser = filters.first ? scopedRows.filter(row => row.advertiser === filters.first) : scopedRows;
  const filteredByOrder = filters.second ? filteredByAdvertiser.filter(row => (row.adOrderCode ?? row.adOrder) === filters.second) : filteredByAdvertiser;
  const adIdOptions = uniqueOptions(filteredByOrder.map(row => row.adId));
  const setAdvertiserFilter = (value: string) => setFilters(prev => ({ ...prev, first: value, second: '', third: '' }));
  const setAdOrderFilter = (value: string) => setFilters(prev => ({ ...prev, second: value, third: '' }));

  const totalReceivable = visibleRows.reduce((sum, row) => {
    return sum + (hasValue(row.receivable) ? Number(row.receivable) : 0);
  }, 0);

  const adTypeCodeForRow = (row: AdvertiserEntryRow) => {
    return row.adOrderCode
      || adOrders.find(order => order.id === row.adOrderId)?.adTypeCode
      || '';
  };

  const adOrderDisplayForRow = (row: AdvertiserEntryRow) => adTypeCodeForRow(row) || row.adOrder;

  const getAdvertiserRowKey = (row: AdvertiserEntryRow) => `${row.advertiser} / ${adOrderDisplayForRow(row)} / ${row.adId}`;

  const hasAnyAdvertiserInput = (row: AdvertiserEntryRow) => {
    if (row.type === 'CPS') return hasValue(row.traffic) || hasValue(row.settlement);
    return hasValue(row.traffic);
  };

  const getAdvertiserRowValidationError = (row: AdvertiserEntryRow) => {
    if (!isAllowedEntryType(row.type)) return 'Only CPM, CPS, and CPA are supported.';
    if (row.type === 'CPS') {
      if (!row.traffic.trim() || !row.settlement.trim()) return 'RATIO requires amount values.';
      if (Number(row.rate) <= 0) return t('ratioMustBePositive');
      return '';
    }
    if (!row.traffic.trim()) return t('requiredFields');
    if (Number(row.rate) <= 0) return t('unitPriceRequired') || t('requiredFields');
    return '';
  };

  const isAdvertiserRowComplete = (row: AdvertiserEntryRow) => hasAnyAdvertiserInput(row) && !getAdvertiserRowValidationError(row);

  const updateRow = (uiKey: string, field: keyof Pick<AdvertiserEntryRow, 'rate' | 'traffic' | 'settlement'>, value: string) => {
    setMessage('');
    setRows(prev => prev.map(row => {
      if (row.uiKey !== uiKey) return row;
      const nextRow = { ...row, [field]: value, status: 'pending' as DataEntryStatus };
      draftRowsRef.current.set(draftKeyForRow(nextRow), {
        rate: nextRow.rate,
        traffic: nextRow.traffic,
        settlement: nextRow.settlement,
      });
      return nextRow;
    }));
  };

  const saveRows = async (targetRows: AdvertiserEntryRow[]) => {
    for (const row of targetRows) {
      const validationError = getAdvertiserRowValidationError(row);
      if (validationError) throw new Error(`${getAdvertiserRowKey(row)}: ${validationError}`);
    }
    const groups = new Map<string, { date: string; adTypeCode: string; records: Array<{ adId: number; type: EntryType; rate: string; traffic: string; settlement: string; recordDate: string }> }>();
    for (const row of targetRows) {
      const date = normalizeDate(row.date);
      const adTypeCode = adTypeCodeForRow(row);
      if (!date || !adTypeCode) throw new Error(t('requiredFields'));
      const key = `${date}:${adTypeCode}`;
      const group = groups.get(key) ?? { date, adTypeCode, records: [] };
      group.records.push({
        adId: row.adIdNum,
        type: row.type,
        rate: row.rate,
        traffic: row.traffic,
        settlement: row.settlement,
        recordDate: date,
      });
      groups.set(key, group);
    }

    const results = await Promise.all(Array.from(groups.values()).map(group => saveAdvertiserEntryBatch(group)));
    const failures = results.flatMap(result => result.errors ?? []);
    if (failures.length) throw new Error(formatBatchErrors(failures));
  };

  const saveRow = async (row: AdvertiserEntryRow) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await saveRows([row]);
      clearDrafts([row]);
      await loadRows();
      setMessage('Saved row successfully.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmRow = async (row: AdvertiserEntryRow) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await saveRows([row]);
      await confirmAdvertiserEntryBatch({ recordDate: normalizeDate(row.date) ?? row.date, adSiteIds: [row.adIdNum] });
      clearDrafts([row]);
      await loadRows();
      setMessage('Confirmed row successfully.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const unconfirmRow = async (row: AdvertiserEntryRow) => {
    if (row.id <= 0) return; // cannot unconfirm a generated (unsaved) row
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await unconfirmAdvertiserEntry(row.id);
      clearDrafts([row]);
      await loadRows();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmAllRows = async () => {
    const pendingRows = visibleRows.filter(row => row.status !== 'confirmed');
    const emptyRows = pendingRows.filter(row => !hasAnyAdvertiserInput(row));
    const inputRows = pendingRows.filter(hasAnyAdvertiserInput);
    const invalidRows = inputRows
      .map(row => ({ row, error: getAdvertiserRowValidationError(row) }))
      .filter(item => item.error);
    const eligibleRows = inputRows.filter(isAdvertiserRowComplete);

    if (!eligibleRows.length) {
      const invalidSummary = invalidRows.length
        ? ` Invalid rows: ${invalidRows.map(item => `${getAdvertiserRowKey(item.row)}: ${item.error}`).join('; ')}`
        : '';
      setError(`${emptyRows.length} empty row(s) skipped; no eligible rows to confirm.${invalidSummary}`);
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      await saveRows(eligibleRows);
      const date = normalizeDate(eligibleRows[0].date) ?? eligibleRows[0].date;
      const result = await confirmAdvertiserEntryBatch({ recordDate: date, adSiteIds: eligibleRows.map(r => r.adIdNum) });
      clearDrafts(eligibleRows);
      await loadRows();
      const invalidSummary = invalidRows.length
        ? ` Invalid ${invalidRows.length}: ${invalidRows.map(item => `${getAdvertiserRowKey(item.row)}: ${item.error}`).join('; ')}`
        : '';
      const backendErrors = result.errors.length ? ` Errors: ${formatBatchErrors(result.errors)}` : '';
      setMessage(`Confirmed ${result.confirmed} row(s); skipped ${emptyRows.length} empty row(s); invalid ${invalidRows.length}.${invalidSummary}${backendErrors}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const downloadAdvertiserCsv = useCallback(() => {
    const header = [t('date'), t('advertiser'), t('adOrder'), t('type'), t('adId'), t('unitPriceRevenueShare'), t('trafficData'), t('settlementOrAdvertiserAmount'), t('receivableAmount'), t('status')];
    const body = visibleRows.map(row => [
      row.date,
      row.advertiser,
      adOrderDisplayForRow(row),
      row.type,
      row.adId,
      row.rate,
      row.traffic,
      row.settlement,
      String(row.receivable ?? ''),
      row.status,
    ]);
    const dateStr = filters.startDate || new Date().toISOString().slice(0, 10);
    downloadCsv(`data-entry-advertiser-${dateStr}.csv`, header, body);
  }, [visibleRows, filters, t]);

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pAdvEntry')}</h1></div>
      <div className="card data-entry-card entry-card entry-table-card">
        <div className="data-entry-filters">
          <DatePickerInput placeholder={t('startDate')} className="input-sm filter-date" value={filters.startDate} onChange={value => updateFilter(setFilters, 'startDate', value)} />
          <div className="filter-spacer"></div>
          <select className="input-sm" value={filters.first} onChange={e => setAdvertiserFilter(e.target.value)}>
            <option value="">{t('selectAdvertiser')}</option>
            {advertiserOptions.map(item => <option key={item} value={item}>{displayName(item)}</option>)}
          </select>
          <select className="input-sm" value={filters.second} onChange={e => setAdOrderFilter(e.target.value)}>
            <option value="">{t('selectAdOrder')}</option>
            {adOrderOptions.map(item => <option key={item} value={item}>{displayName(item)}</option>)}
          </select>
          <select className="input-sm" value={filters.third} onChange={e => updateFilter(setFilters, 'third', e.target.value)}>
            <option value="">{t('selectAdId')}</option>
            {adIdOptions.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="input-sm status-filter" value={filters.status} onChange={e => updateFilter(setFilters, 'status', e.target.value)}>
            <option value="">{t('allStatuses')}</option>
            <option value="pending">{t('pendingConfirm')}</option>
            <option value="confirmed">{t('confirmed')}</option>
          </select>
          <input type="text" placeholder={t('search')} className="input-sm filter-search" value={filters.search} onChange={e => updateFilter(setFilters, 'search', e.target.value)} />
          {/* ADV CSV DOWNLOAD */}
          <button className="btn-primary input-sm data-download-btn" onClick={() => downloadAdvertiserCsv()}>{t('dataDownload')}</button>
        </div>
        {error && <div className="form-error">{error}</div>}
        {message && <div style={{ color: 'var(--success, #16a34a)', fontSize: '13px', marginBottom: '8px' }}>{message}</div>}

        <div className="table-wrap entry-table-wrap entry-table-scroll">
          <table className="entry-table">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('advertiser')}</th>
                <th>{t('adOrder')}</th>
                <th>{t('type')}</th>
                <th>{t('adId')}</th>
                <th>{t('unitPriceRevenueShare')}</th>
                <th>{t('trafficData')}</th>
                <th>{t('settlementOrAdvertiserAmount')}</th>
                <th>{t('receivableAmount')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="empty-state-text">Loading...</td></tr>
              ) : visibleRows.map(row => {
                const isConfirmed = row.status === 'confirmed';
                const isLocked = isConfirmed || busy;
                return (
                  <tr key={row.uiKey} className={isConfirmed ? 'entry-row-confirmed' : ''}>
                    <td>{row.date}</td>
                    <td>{displayName(row.advertiser)}</td>
                    <td>{displayName(adOrderDisplayForRow(row))}</td>
                    <td>{row.type}</td>
                    <td>{row.adId}</td>
                    <td><input className={`cell-input ${isLocked ? 'cell-input-locked' : ''}`} value={row.rate} placeholder={t('valuePlaceholder')} disabled={isLocked} onChange={e => updateRow(row.uiKey, 'rate', e.target.value)} /></td>
                    {row.type === 'CPM' || row.type === 'CPA'
                      ? <td><input className={`cell-input ${isLocked ? 'cell-input-locked' : ''}`} value={row.traffic} placeholder={t('valuePlaceholder')} disabled={isLocked} onChange={e => updateRow(row.uiKey, 'traffic', e.target.value)} /></td>
                      : null}
                    {row.type === 'CPM' || row.type === 'CPA'
                      ? <td className="amount-cell">—</td>
                      : null}
                    {row.type === 'CPS'
                      ? <td><input className={`cell-input ${isLocked ? 'cell-input-locked' : ''}`} value={row.traffic} placeholder={t('valuePlaceholder')} disabled={isLocked} onChange={e => updateRow(row.uiKey, 'traffic', e.target.value)} /></td>
                      : null}
                    {row.type === 'CPS'
                      ? <td><input className={`cell-input cell-input-wide ${isLocked ? 'cell-input-locked' : ''}`} value={row.settlement} placeholder={t('valuePlaceholder')} disabled={isLocked} onChange={e => updateRow(row.uiKey, 'settlement', e.target.value)} /></td>
                      : null}
                    <td className="amount-cell">{hasValue(row.receivable) ? formatAmount(row.receivable) : '--'}</td>
                    <td><ConfirmButton confirmed={isConfirmed} onClick={() => void confirmRow(row)} /></td>
                    <td className="entry-action-cell">
                      {isConfirmed
                        ? <button className="entry-edit-btn" type="button" disabled={busy} onClick={() => void unconfirmRow(row)}>{t('modify')}</button>
                        : <button className="entry-edit-btn" type="button" disabled={busy} onClick={() => void saveRow(row)}>{t('saveSystem')}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="entry-total-row entry-total-sticky">
                <td>{filters.startDate || t('total')}</td>
                <td colSpan={7} className="total-label">{t('total')}:</td>
                <td className="amount-cell">{formatAmount(totalReceivable)}</td>
                <td><button className="entry-confirm-btn all" onClick={() => void confirmAllRows()} disabled={busy}>{t('confirmAllData')}</button></td>
                <td><span className="entry-empty-action">--</span></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export function MediaDataMgmt() {
  const { t, displayName } = useAppContext();
  const [filters, setFilters] = useState<EntryFilters>(emptyFilters);
  const [rows, setRows] = useState<MediaEntryRow[]>([]);
  const [adOrders, setAdOrders] = useState<AdOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadRows = React.useCallback(async () => {
    const date = normalizeDate(filters.startDate);
    if (!date) return;
    setLoading(true);
    setError('');
    try {
      const [orders, dateRows] = await Promise.all([
        listAdOrders(),
        listMediaEntries({ date }),
      ]);
      setAdOrders(orders);
      setRows((Array.isArray(dateRows) ? dateRows : []).filter(row => isAllowedEntryType(row.type)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters.startDate]);

  React.useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const scopedRows = useMemo(() => rows.filter(row => row.date === normalizeDate(filters.startDate)), [rows, filters.startDate]);

  const filteredRows = useMemo(() => scopedRows.filter(row => {
    const keyword = filters.search.trim().toLowerCase();
    return (!filters.first || row.media === filters.first)
      && (!filters.second || (row.mediaAdOrderCode ?? row.mediaAdOrder) === filters.second)
      && (!filters.third || row.mediaIdStr === filters.third)
      && matchesStatusFilter(row.status, filters.status)
      && (!keyword || [row.media, row.mediaAdOrder, row.mediaIdStr, row.type, displayName(row.media), displayName(row.mediaAdOrder)].some(item => String(item ?? '').toLowerCase().includes(keyword)));
  }), [scopedRows, filters, displayName]);

  const visibleRows = useMemo(
    () => sortRowsByDate(filteredRows.length ? filteredRows : scopedRows, ['media', 'mediaAdOrder', 'mediaId']),
    [filteredRows, scopedRows]
  );
  const mediaOptions = uniqueOptions(scopedRows.map(row => row.media));
  const mediaOrderOptions = uniqueOptions(scopedRows.map(row => row.mediaAdOrderCode ?? row.mediaAdOrder).filter(Boolean));
  const filteredByMedia = filters.first ? scopedRows.filter(row => row.media === filters.first) : scopedRows;
  const filteredByOrder = filters.second ? filteredByMedia.filter(row => (row.mediaAdOrderCode ?? row.mediaAdOrder) === filters.second) : filteredByMedia;
  const mediaIdOptions = uniqueOptions(filteredByOrder.map(row => row.mediaIdStr));
  const setMediaFilter = (value: string) => setFilters(prev => ({ ...prev, first: value, second: '', third: '' }));
  const setMediaOrderFilter = (value: string) => setFilters(prev => ({ ...prev, second: value, third: '' }));

  const totalActual = visibleRows.reduce((sum, row) => {
    return sum + (hasValue(row.actualReceived) ? Number(row.actualReceived) : 0);
  }, 0);
  const totalDate = filters.startDate || visibleRows[0]?.date || t('total');

  const adTypeCodeForRow = (row: MediaEntryRow) => {
    return row.mediaAdOrderCode
      || adOrders.find(order => order.id === row.mediaAdOrderId)?.adTypeCode
      || '';
  };

  const updateRow = (uiKey: string, field: keyof Pick<MediaEntryRow, 'rate' | 'traffic' | 'settlement' | 'dataCoefficient'>, value: string) => {
    setRows(prev => prev.map(row => row.uiKey === uiKey ? { ...row, [field]: value, status: 'pending' as DataEntryStatus } : row));
  };

  const saveRows = async (targetRows: MediaEntryRow[]) => {
    for (const row of targetRows) {
      if (!isAllowedEntryType(row.type)) throw new Error('Only CPM, CPS, and CPA are supported.');
      if (row.type === 'CPS') {
        if (!row.traffic.trim() || !row.settlement.trim()) throw new Error('RATIO requires amount values.');
        if (Number(row.rate) <= 0) throw new Error(t('ratioMustBePositive'));
      } else {
        // CPM and CPA require qty (traffic field) and unitPrice (rate)
        if (!row.traffic.trim()) throw new Error(t('requiredFields'));
        if (!isNeutralDataCoefficient(row.dataCoefficient)) throw new Error('dataCoefficient must be neutral: 1, 100%, or empty.');
      }
    }
    const groups = new Map<string, { date: string; adTypeCode: string; records: Array<{ mediaId: number; type: EntryType; rate: string; traffic: string; settlement: string; dataCoefficient: string; recordDate: string }> }>();
    for (const row of targetRows) {
      const date = normalizeDate(row.date);
      const adTypeCode = adTypeCodeForRow(row);
      if (!date || !adTypeCode) throw new Error(t('requiredFields'));
      const key = `${date}:${adTypeCode}`;
      const group = groups.get(key) ?? { date, adTypeCode, records: [] };
      group.records.push({
        mediaId: row.upstreamAdIdNum,
        type: row.type,
        rate: row.type === 'CPS' ? row.rate : (row.rate || ''),
        traffic: row.traffic,
        settlement: row.settlement,
        dataCoefficient: row.dataCoefficient,
        recordDate: date,
      });
      groups.set(key, group);
    }

    const results = await Promise.all(Array.from(groups.values()).map(group => saveMediaEntryBatch(group)));
    const failures = results.flatMap(result => result.errors ?? []);
    if (failures.length) throw new Error(formatBatchErrors(failures));
  };

  const saveRow = async (row: MediaEntryRow) => {
    setBusy(true);
    setError('');
    try {
      await saveRows([row]);
      await loadRows();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmRow = async (row: MediaEntryRow) => {
    setBusy(true);
    setError('');
    try {
      await saveRows([row]);
      await confirmMediaEntryBatch({ recordDate: normalizeDate(row.date) ?? row.date, adSiteIds: [row.upstreamAdIdNum] });
      await loadRows();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const unconfirmRow = async (row: MediaEntryRow) => {
    if (row.id <= 0) return; // cannot unconfirm a generated (unsaved) row
    setBusy(true);
    setError('');
    try {
      await unconfirmMediaEntry(row.id);
      await loadRows();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmAllRows = async () => {
    const pendingRows = visibleRows.filter(row => row.status !== 'confirmed');
    if (!pendingRows.length) return;
    setBusy(true);
    setError('');
    try {
      await saveRows(pendingRows);
      const date = normalizeDate(pendingRows[0].date) ?? pendingRows[0].date;
      await confirmMediaEntryBatch({ recordDate: date, adSiteIds: pendingRows.map(r => r.upstreamAdIdNum) });
      await loadRows();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const downloadMediaCsv = useCallback(() => {
    const header = [t('date'), t('media'), t('mediaAdOrder'), t('type'), t('mediaId'), t('unitPriceRevenueShare'), t('trafficData'), t('settlementOrAdvertiserAmount'), t('dataCoefficient'), t('receivableAmount'), t('shareRatio'), t('actualReceivedAmount'), t('status')];
    const body = visibleRows.map(row => [
      row.date,
      row.media,
      row.mediaAdOrder,
      row.type,
      row.mediaIdStr,
      row.rate,
      row.traffic,
      row.settlement,
      row.dataCoefficient,
      String(row.receivable ?? ''),
      row.shareRatio,
      String(row.actualReceived ?? ''),
      row.status,
    ]);
    const dateStr = filters.startDate || new Date().toISOString().slice(0, 10);
    downloadCsv(`data-entry-media-${dateStr}.csv`, header, body);
  }, [visibleRows, filters, t]);

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pMediaDataMgmt')}</h1></div>
      <div className="card data-entry-card entry-card entry-table-card">
        <div className="data-entry-filters">
          <DatePickerInput placeholder={t('startDate')} className="input-sm filter-date" value={filters.startDate} onChange={value => updateFilter(setFilters, 'startDate', value)} />
          <div className="filter-spacer"></div>
          <select className="input-sm" value={filters.first} onChange={e => setMediaFilter(e.target.value)}>
            <option value="">{t('selectMedia')}</option>
            {mediaOptions.map(item => <option key={item} value={item}>{displayName(item)}</option>)}
          </select>
          <select className="input-sm" value={filters.second} onChange={e => setMediaOrderFilter(e.target.value)}>
            <option value="">{t('selectMediaAdOrder')}</option>
            {mediaOrderOptions.map(item => <option key={item} value={item}>{displayName(item)}</option>)}
          </select>
          <select className="input-sm" value={filters.third} onChange={e => updateFilter(setFilters, 'third', e.target.value)}>
            <option value="">{t('selectMediaId')}</option>
            {mediaIdOptions.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="input-sm status-filter" value={filters.status} onChange={e => updateFilter(setFilters, 'status', e.target.value)}>
            <option value="">{t('allStatuses')}</option>
            <option value="pending">{t('pendingConfirm')}</option>
            <option value="confirmed">{t('confirmed')}</option>
          </select>
          <input type="text" placeholder={t('search')} className="input-sm filter-search" value={filters.search} onChange={e => updateFilter(setFilters, 'search', e.target.value)} />
          {/* MEDIA CSV DOWNLOAD */}
          <button className="btn-primary input-sm data-download-btn" onClick={() => downloadMediaCsv()}>{t('dataDownload')}</button>
        </div>
        {error && <div className="form-error">{error}</div>}

        <div className="table-wrap entry-table-wrap entry-table-scroll">
          <table className="entry-table media-entry-table">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('media')}</th>
                <th>{t('mediaAdOrder')}</th>
                <th>{t('type')}</th>
                <th>{t('mediaId')}</th>
                <th>{t('unitPriceRevenueShare')}</th>
                <th>{t('trafficData')}</th>
                <th>{t('settlementOrAdvertiserAmount')}</th>
                <th>{t('dataCoefficient')}</th>
                <th>{t('receivableAmount')}</th>
                <th>{t('shareRatio')}</th>
                <th>{t('actualReceivedAmount')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={14} className="empty-state-text">Loading...</td></tr>
              ) : visibleRows.map(row => {
                const isConfirmed = row.status === 'confirmed';
                const isLocked = isConfirmed || busy;
                return (
                  <tr key={row.uiKey} className={isConfirmed ? 'entry-row-confirmed' : ''}>
                    <td>{row.date}</td>
                    <td>{displayName(row.media)}</td>
                    <td>{displayName(row.mediaAdOrder)}</td>
                    <td>{row.type}</td>
                    <td>{row.mediaIdStr}</td>
                    <td><input className={`cell-input ${isLocked ? 'cell-input-locked' : ''}`} value={row.rate === '—' ? '' : row.rate} placeholder={t('valuePlaceholder')} disabled={isLocked} onChange={e => updateRow(row.uiKey, 'rate', e.target.value)} /></td>
                    {row.type === 'CPM' || row.type === 'CPA'
                      ? <><td><input className={`cell-input ${isLocked ? 'cell-input-locked' : ''}`} value={row.traffic} placeholder={t('valuePlaceholder')} disabled={isLocked} onChange={e => updateRow(row.uiKey, 'traffic', e.target.value)} /></td>
                      <td className="amount-cell">—</td>
                      <td className="amount-cell">—</td>
                      <td className="amount-cell">—</td></>
                      : null}
                    {row.type === 'CPS'
                      ? <><td><input className={`cell-input ${isLocked ? 'cell-input-locked' : ''}`} value={row.traffic} placeholder={t('valuePlaceholder')} disabled={isLocked} onChange={e => updateRow(row.uiKey, 'traffic', e.target.value)} /></td>
                      <td><input className={`cell-input cell-input-wide ${isLocked ? 'cell-input-locked' : ''}`} value={row.settlement} placeholder={t('valuePlaceholder')} disabled={isLocked} onChange={e => updateRow(row.uiKey, 'settlement', e.target.value)} /></td>
                      <td className="amount-cell">—</td>
                      <td className="amount-cell">—</td></>
                      : null}
                    <td className="amount-cell">{hasValue(row.receivable) ? formatAmount(row.receivable) : '--'}</td>
                    <td>{hasValue(row.shareRatio) ? row.shareRatio : '--'}</td>
                    <td className="amount-cell">{hasValue(row.actualReceived) ? formatAmount(row.actualReceived) : '--'}</td>
                    <td><ConfirmButton confirmed={isConfirmed} onClick={() => void confirmRow(row)} /></td>
                    <td className="entry-action-cell">
                      {isConfirmed
                        ? <button className="entry-edit-btn" type="button" disabled={busy} onClick={() => void unconfirmRow(row)}>{t('modify')}</button>
                        : <button className="entry-edit-btn" type="button" disabled={busy} onClick={() => void saveRow(row)}>{t('saveSystem')}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="entry-total-row entry-total-sticky">
                <td>{totalDate}</td>
                <td colSpan={10}></td>
                <td className="amount-cell">{formatAmount(totalActual)}</td>
                <td><button className="entry-confirm-btn all" onClick={() => void confirmAllRows()} disabled={busy}>{t('confirmAllData')}</button></td>
                <td><span className="entry-empty-action">--</span></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
