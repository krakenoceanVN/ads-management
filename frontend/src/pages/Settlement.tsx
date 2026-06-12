import React from 'react';
import { useAppContext } from '../AppContext';
import { Table } from '../components/Table';
import { getAdvertiserSettlement, getMediaSettlement } from '../lib/bffApi';
import type { AdvertiserSettlementRow, MediaSettlementRow } from '../lib/bffTypes';

const DEFAULT_SETTLEMENT_PERIOD = '2026-05';
const SETTLEMENT_YEAR_RANGE = 5;

function settlementYears() {
  const fallbackYear = Number(DEFAULT_SETTLEMENT_PERIOD.slice(0, 4)) || new Date().getFullYear();
  const nowYear = new Date().getFullYear();
  const center = Math.max(fallbackYear, nowYear);
  const years: number[] = [];
  for (let y = center - SETTLEMENT_YEAR_RANGE; y <= center + SETTLEMENT_YEAR_RANGE; y++) {
    years.push(y);
  }
  return years;
}

function SettlementMonthSelect({ value, onChange, t }: { value: string; onChange: (value: string) => void; t: (key: string) => string }) {
  const [yearPart, monthPart] = (() => {
    const match = /^(\d{4})-(\d{2})$/.exec(value || '');
    if (match) return [match[1], match[2]];
    const fallback = DEFAULT_SETTLEMENT_PERIOD.split('-');
    return [fallback[0] || String(new Date().getFullYear()), fallback[1] || '01'];
  })();
  const years = React.useMemo(settlementYears, []);
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  const update = (nextYear: string, nextMonth: string) => onChange(`${nextYear}-${nextMonth}`);

  return (
    <span className="settlement-month-select">
      <select
        className="filter-select settlement-month-year"
        value={yearPart}
        onChange={event => update(event.target.value, monthPart)}
        aria-label={t('year')}
      >
        {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
      </select>
      <select
        className="filter-select settlement-month-month"
        value={monthPart}
        onChange={event => update(yearPart, event.target.value)}
        aria-label={t('month')}
      >
        {months.map(m => <option key={m} value={m}>{t(`month${m}`)}</option>)}
      </select>
    </span>
  );
}

type CsvColumn<T> = {
  label: string;
  value: (row: T) => string | number;
};

function hasValue(value: unknown) {
  return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function formatAmount(value: unknown) {
  if (!hasValue(value)) return '--';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatPercent(value: unknown) {
  if (!hasValue(value)) return '--';
  const numberValue = Number(value);
  const percent = Math.abs(numberValue) <= 1 ? numberValue * 100 : numberValue;
  return `${percent.toFixed(2)}%`;
}

function formatAdType(row: { adTypeName?: string | null; adTypeCode?: string | null }) {
  return displayNameOr(row.adTypeName, row.adTypeCode) ?? '--';
}

function displayNameOr(name: string | null | undefined, fallback: string | null | undefined) {
  const trimmed = (name ?? '').trim();
  if (trimmed) return trimmed;
  return (fallback ?? '').trim() || null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Request failed');
}

function csvEscape(value: string | number) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]) {
  const header = columns.map(column => csvEscape(column.label)).join(',');
  const body = rows.map(row => columns.map(column => csvEscape(column.value(row))).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function uniqueById<T>(rows: T[], getId: (row: T) => number, getName: (row: T) => string) {
  const map = new Map<number, string>();
  rows.forEach(row => {
    const id = getId(row);
    const name = getName(row);
    if (Number.isFinite(id) && name) map.set(id, name);
  });
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}

export function AdvSettlement() {
  const { t, displayName } = useAppContext();
  const [period, setPeriod] = React.useState(DEFAULT_SETTLEMENT_PERIOD);
  const [advertiserId, setAdvertiserId] = React.useState('');
  const [rows, setRows] = React.useState<AdvertiserSettlementRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const loadRows = React.useCallback(() => {
    if (!period) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError('');
    getAdvertiserSettlement({
      period,
      advertiserId: advertiserId ? Number(advertiserId) : undefined,
    })
      .then(setRows)
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [period, advertiserId]);

  React.useEffect(() => {
    loadRows();
  }, [loadRows]);

  const visibleRows = advertiserId
    ? rows.filter(row => row.advertiserId === Number(advertiserId))
    : rows;
  const advertisers = uniqueById(rows, row => row.advertiserId, row => row.advertiser);

  const columns: CsvColumn<AdvertiserSettlementRow>[] = [
    { label: t('period'), value: row => row.period },
    { label: t('advertiser'), value: row => displayName(row.advertiser) },
    { label: t('adType'), value: row => formatAdType(row) },
    { label: t('amount'), value: row => formatAmount(row.totalAmount) },
    { label: 'Records', value: row => row.recordCount },
  ];

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pAdvSettlement')}</h1></div>
      <div className="card">
        <div className="report-filters">
          <SettlementMonthSelect value={period} onChange={setPeriod} t={t} />
          <select className="filter-select" value={advertiserId} onChange={event => setAdvertiserId(event.target.value)}>
            <option value="">{t('selectAdvertiser')}</option>
            {advertisers.map(advertiser => <option key={advertiser.id} value={advertiser.id}>{displayName(advertiser.name)}</option>)}
          </select>
          <button className="btn-primary" onClick={loadRows}>{t('query')}</button>
          <button className="btn-outline" onClick={() => downloadCsv('广告主结算单.csv', columns, visibleRows)}>{t('export')}</button>
        </div>
        {error && <div className="form-error">{error}</div>}
        {loading ? <div className="empty-state"><div className="empty-state-text">{t('loading')}</div></div> : (
          <Table
            columns={[
              { key: 'period', label: t('period') },
              { key: 'advertiser', label: t('advertiser'), render: row => displayName(row.advertiser) },
              { key: 'adTypeCode', label: t('adType'), render: row => formatAdType(row) },
              { key: 'totalAmount', label: t('amount'), render: row => formatAmount(row.totalAmount) },
              { key: 'recordCount', label: 'Records' },
            ]}
            data={visibleRows}
          />
        )}
      </div>
    </div>
  );
}

export function MediaSettlement() {
  const { t, displayName } = useAppContext();
  const [period, setPeriod] = React.useState(DEFAULT_SETTLEMENT_PERIOD);
  const [mediaId, setMediaId] = React.useState('');
  const [rows, setRows] = React.useState<MediaSettlementRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const loadRows = React.useCallback(() => {
    if (!period) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError('');
    getMediaSettlement({
      period,
      mediaId: mediaId ? Number(mediaId) : undefined,
    })
      .then(setRows)
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [period, mediaId]);

  React.useEffect(() => {
    loadRows();
  }, [loadRows]);

  const visibleRows = mediaId
    ? rows.filter(row => row.mediaId === Number(mediaId))
    : rows;
  const mediaOptions = uniqueById(rows, row => row.mediaId, row => row.media);

  const columns: CsvColumn<MediaSettlementRow>[] = [
    { label: t('period'), value: row => row.period },
    { label: t('media'), value: row => displayName(row.media) },
    { label: 'Downstream', value: row => row.downstreamName ?? '--' },
    { label: t('adType'), value: row => formatAdType(row) },
    { label: t('revenue'), value: row => formatAmount(row.revenue) },
    { label: t('expense'), value: row => formatAmount(row.cost) },
    { label: t('profit'), value: row => formatAmount(row.profit) },
    { label: t('profitMargin'), value: row => formatPercent(row.profitRate) },
    { label: 'Records', value: row => row.recordCount },
  ];

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pMediaSettlement')}</h1></div>
      <div className="card">
        <div className="report-filters">
          <SettlementMonthSelect value={period} onChange={setPeriod} t={t} />
          <select className="filter-select" value={mediaId} onChange={event => setMediaId(event.target.value)}>
            <option value="">{t('selectMedia')}</option>
            {mediaOptions.map(media => <option key={media.id} value={media.id}>{displayName(media.name)}</option>)}
          </select>
          <button className="btn-primary" onClick={loadRows}>{t('query')}</button>
          <button className="btn-outline" onClick={() => downloadCsv('媒体结算单.csv', columns, visibleRows)}>{t('export')}</button>
        </div>
        {error && <div className="form-error">{error}</div>}
        {loading ? <div className="empty-state"><div className="empty-state-text">{t('loading')}</div></div> : (
          <Table
            columns={[
              { key: 'period', label: t('period') },
              { key: 'media', label: t('media'), render: row => displayName(row.media) },
              { key: 'downstreamName', label: 'Downstream', render: row => row.downstreamName ?? '--' },
              { key: 'adTypeCode', label: t('adType'), render: row => formatAdType(row) },
              { key: 'revenue', label: t('revenue'), render: row => formatAmount(row.revenue) },
              { key: 'cost', label: t('expense'), render: row => formatAmount(row.cost) },
              { key: 'profit', label: t('profit'), render: row => formatAmount(row.profit) },
              { key: 'profitRate', label: t('profitMargin'), render: row => formatPercent(row.profitRate) },
              { key: 'recordCount', label: 'Records' },
            ]}
            data={visibleRows}
          />
        )}
      </div>
    </div>
  );
}
