import React from 'react';
import { CalendarDays, Search } from 'lucide-react';
import { useAppContext } from '../AppContext';
import {
  getAdvertiserReport,
  getMediaReport,
  getOrderProfitReport,
  getTotalProfitReport,
} from '../lib/bffApi';
import type {
  AdvertiserEntryRow,
  MediaEntryRow,
  OrderProfitReportRow,
  ReportStatusParam,
  TotalProfitReportRow,
} from '../lib/bffTypes';
import { sortRowsByDate } from '../lib/date';

type CsvColumn<T> = {
  label: string;
  value: (row: T) => string | number;
};

type StatusFilter = '' | 'online' | 'offline' | 'confirmed' | 'pendingConfirm' | 'all';

const DEFAULT_REPORT_PERIOD = '2026-05';
const totalProfitInFlight = new Map<string, Promise<TotalProfitReportRow[]>>();
const orderProfitInFlight = new Map<string, Promise<OrderProfitReportRow[]>>();
const advQueryInFlight = new Map<string, Promise<AdvertiserEntryRow[]>>();
const mediaQueryInFlight = new Map<string, Promise<MediaEntryRow[]>>();

function loadTotalProfitRows(date: string) {
  const existing = totalProfitInFlight.get(date);
  if (existing) return existing;
  const request = getTotalProfitReport({ date }).finally(() => {
    totalProfitInFlight.delete(date);
  });
  totalProfitInFlight.set(date, request);
  return request;
}

function loadOrderProfitRows(date: string, adTypeCode?: string) {
  const key = `${date}:${adTypeCode ?? ''}`;
  const existing = orderProfitInFlight.get(key);
  if (existing) return existing;
  const request = getOrderProfitReport({ date, adTypeCode }).finally(() => {
    orderProfitInFlight.delete(key);
  });
  orderProfitInFlight.set(key, request);
  return request;
}

function numeric(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

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

function sumRows<T>(rows: T[], getter: (row: T) => unknown) {
  return rows.reduce((sum, row) => sum + numeric(getter(row)), 0);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
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

function matchesLocalized(displayName: (value: string | number | undefined | null) => string, keyword: string, values: Array<string | number | undefined>) {
  if (!keyword) return true;
  return values.some(value => String(value ?? '').includes(keyword) || displayName(value).includes(keyword));
}

function statusParam(filter: StatusFilter): ReportStatusParam | undefined {
  if (filter === 'all') return 'all';
  if (filter === 'online' || filter === 'confirmed') return 'confirmed';
  if (filter === 'offline' || filter === 'pendingConfirm') return 'pending';
  return undefined;
}

function matchesStatus(status: 'pending' | 'confirmed', filter: StatusFilter) {
  if (!filter || filter === 'all') return true;
  if (filter === 'online' || filter === 'confirmed') return status === 'confirmed';
  if (filter === 'offline' || filter === 'pendingConfirm') return status === 'pending';
  return true;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Request failed');
}

function StatusBadge({ status }: { status: 'pending' | 'confirmed' }) {
  const { t } = useAppContext();
  const className = status === 'confirmed' ? 'online' : 'offline';
  const label = status === 'confirmed' ? t('confirmed') : t('pendingConfirm');
  return <span className={`query-status ${className}`}>{label}</span>;
}

function LoadingRow({ colSpan }: { colSpan: number }) {
  return <tr><td colSpan={colSpan} className="empty-state-text">Loading...</td></tr>;
}

function EmptyRow({ colSpan, text = '—' }: { colSpan: number; text?: string }) {
  return <tr><td colSpan={colSpan} className="empty-state-text">{text}</td></tr>;
}

function DownloadButton({ onClick }: { onClick: () => void }) {
  const { t } = useAppContext();
  return <button type="button" className="btn-primary report-download-btn data-download-btn" onClick={onClick}>{t('dataDownload')}</button>;
}

function compactSearchPlaceholder(value: string) {
  return value.replace(/\s*\.\.\.$/, '').replace(/\s*…$/, '');
}

function ReportDateField({
  value,
  onChange,
  placeholder,
  type = 'date',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: 'date' | 'month';
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      // Browser may reject showPicker unless the click is a direct user gesture.
    }
  };

  return (
    <div className="report-date-field" onClick={openPicker}>
      <span className={`report-date-text ${value ? '' : 'placeholder'}`}>{value || placeholder}</span>
      <CalendarDays className="report-date-icon" size={15} strokeWidth={1.8} />
      <input
        ref={inputRef}
        type={type}
        className="report-date-native"
        value={value}
        aria-label={placeholder}
        onChange={event => onChange(event.target.value)}
      />
    </div>
  );
}

function ReportDateRangeField({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  placeholder,
}: {
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  placeholder: string;
}) {
  const startRef = React.useRef<HTMLInputElement>(null);
  const endRef = React.useRef<HTMLInputElement>(null);

  const openStartPicker = () => {
    const input = startRef.current;
    if (!input) return;
    input.focus();
    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {}
  };

  const openEndPicker = () => {
    const input = endRef.current;
    if (!input) return;
    input.focus();
    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {}
  };

  const label = startValue && endValue ? `${startValue} — ${endValue}` : placeholder;

  return (
    <div className="report-date-range-field" onClick={openStartPicker}>
      <span className={`report-date-text ${startValue && endValue ? '' : 'placeholder'}`}>{label}</span>
      <CalendarDays className="report-date-icon" size={15} strokeWidth={1.8} />
      <div className="report-date-range-inputs">
        <input
          ref={startRef}
          type="date"
          className="report-date-native"
          value={startValue}
          aria-label={`${placeholder} start`}
          onChange={event => onStartChange(event.target.value)}
          onClick={e => e.stopPropagation()}
        />
        <span className="report-date-range-sep">—</span>
        <input
          ref={endRef}
          type="date"
          className="report-date-native"
          value={endValue}
          aria-label={`${placeholder} end`}
          onChange={event => onEndChange(event.target.value)}
          onClick={e => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

function ReportSearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="report-search">
      <input className="report-control" placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} />
      <Search className="report-search-icon" size={14} strokeWidth={1.9} />
    </div>
  );
}

function ReportBusinessSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const { t, displayName } = useAppContext();

  return (
    <div className="report-business-control" aria-label={t('business')}>
      <span className="report-business-label">{t('business')}</span>
      <select className="report-control report-select report-business-select" value={value} onChange={event => onChange(event.target.value)} aria-label={t('business')}>
        <option value="">{t('allBusiness')}</option>
        {options.map(option => <option key={option.value} value={option.value}>{displayName(option.label)}</option>)}
      </select>
    </div>
  );
}

function businessOptionsFromRows<T>(rows: T[], getValue: (row: T) => string, getLabel: (row: T) => string = getValue) {
  const options = new Map<string, string>();
  rows.forEach(row => {
    const value = getValue(row);
    if (value && !options.has(value)) options.set(value, getLabel(row) || value);
  });
  return Array.from(options, ([value, label]) => ({ value, label }));
}

export function TotalProfit() {
  const { t, displayName } = useAppContext();
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [rows, setRows] = React.useState<TotalProfitReportRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!startDate || !endDate) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    getTotalProfitReport({ startDate, endDate })
      .then(data => {
        if (!cancelled) setRows(data);
      })
      .catch(err => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const totalRow = rows.find(row => row.date.endsWith('-total'));
  const dailyRows = rows.filter(row => !row.date.endsWith('-total'));
  const visibleRows = dailyRows.filter(row =>
    matchesLocalized(displayName, search, [row.date, row.revenue, row.cost, row.profit])
  );

  const columns: CsvColumn<TotalProfitReportRow>[] = [
    { label: t('date'), value: row => row.date },
    { label: t('revenue'), value: row => formatAmount(row.revenue) },
    { label: 'ML payout', value: row => formatAmount(row.ml_payout) },
    { label: 'LE payout', value: row => formatAmount(row.le_payout) },
    { label: 'Yiyi payout', value: row => formatAmount(row.yiyi_payout) },
    { label: t('expense'), value: row => formatAmount(row.cost) },
    { label: t('taxAmount'), value: row => formatAmount(row.tax) },
    { label: t('profit'), value: row => formatAmount(row.profit) },
    { label: t('profitMargin'), value: row => formatPercent(row.profit_rate) },
  ];

  const exportRows = totalRow ? [...visibleRows, totalRow] : visibleRows;

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pTotalProfit')}</h1></div>
      <div className="card report-card report-table-card total-profit-card">
        <div className="report-toolbar">
          <div className="report-toolbar-left">
            <ReportDateRangeField
              startValue={startDate}
              endValue={endDate}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
              placeholder={t('date')}
            />
          </div>
          <div className="report-toolbar-right">
            <ReportSearchField placeholder={compactSearchPlaceholder(t('search'))} value={search} onChange={setSearch} />
            <DownloadButton onClick={() => downloadCsv('总利润表.csv', columns, exportRows)} />
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="table-wrap report-table-wrap report-table-scroll">
          <table className="report-table">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('revenue')}</th>
                <th>ML payout</th>
                <th>LE payout</th>
                <th>Yiyi payout</th>
                <th>{t('expense')}</th>
                <th>{t('taxAmount')}</th>
                <th>{t('profit')}</th>
                <th>{t('profitMargin')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <LoadingRow colSpan={9} /> : visibleRows.length ? visibleRows.map(row => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td className="amount-cell">{formatAmount(row.revenue)}</td>
                  <td>{formatAmount(row.ml_payout)}</td>
                  <td>{formatAmount(row.le_payout)}</td>
                  <td>{formatAmount(row.yiyi_payout)}</td>
                  <td>{formatAmount(row.cost)}</td>
                  <td>{formatAmount(row.tax)}</td>
                  <td className="amount-cell">{formatAmount(row.profit)}</td>
                  <td>{formatPercent(row.profit_rate)}</td>
                </tr>
              )) : <EmptyRow colSpan={9} />}
            </tbody>
            {totalRow && (
              <tfoot>
                <tr className="report-total-row report-total-sticky">
                  <td>{t('total')}</td>
                  <td>{formatAmount(totalRow.revenue)}</td>
                  <td>{formatAmount(totalRow.ml_payout)}</td>
                  <td>{formatAmount(totalRow.le_payout)}</td>
                  <td>{formatAmount(totalRow.yiyi_payout)}</td>
                  <td>{formatAmount(totalRow.cost)}</td>
                  <td>{formatAmount(totalRow.tax)}</td>
                  <td>{formatAmount(totalRow.profit)}</td>
                  <td>{formatPercent(totalRow.profit_rate)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

export function OrderProfit() {
  const { t, displayName } = useAppContext();
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [business, setBusiness] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [rows, setRows] = React.useState<OrderProfitReportRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!startDate || !endDate) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    getOrderProfitReport({ startDate, endDate, adTypeCode: business || undefined })
      .then(data => {
        if (!cancelled) setRows(data);
      })
      .catch(err => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, business]);

  const visibleRows = rows.filter(row =>
    matchesLocalized(displayName, search, [row.advertiser, row.adTypeCode, row.adTypeName])
  );
  const businessOptions = businessOptionsFromRows(rows, row => row.adTypeCode, row => row.adTypeName);

  const columns: CsvColumn<OrderProfitReportRow>[] = [
    { label: t('advertiser'), value: row => displayName(row.advertiser) },
    { label: t('adOrder'), value: row => displayName(row.adTypeName) },
    { label: 'Code', value: row => row.adTypeCode },
    { label: t('revenue'), value: row => formatAmount(row.totalRevenue) },
    { label: t('trafficData'), value: row => formatAmount(row.totalQty) },
    { label: 'Records', value: row => row.recordCount },
  ];

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pOrderProfit')}</h1></div>
      <div className="card report-card report-table-card order-profit-card">
        <div className="report-toolbar">
          <div className="report-toolbar-left">
            <ReportDateRangeField
              startValue={startDate}
              endValue={endDate}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
              placeholder={t('date')}
            />
          </div>
          <div className="report-toolbar-right">
            <ReportBusinessSelect value={business} onChange={setBusiness} options={businessOptions} />
            <ReportSearchField placeholder={t('searchName')} value={search} onChange={setSearch} />
            <DownloadButton onClick={() => downloadCsv('广告单利润表.csv', columns, visibleRows)} />
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="table-wrap report-table-wrap report-table-scroll">
          <table className="report-table">
            <thead>
              <tr>
                <th>{t('advertiser')}</th>
                <th>{t('adOrder')}</th>
                <th>Code</th>
                <th>{t('revenue')}</th>
                <th>{t('trafficData')}</th>
                <th>Records</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <LoadingRow colSpan={6} /> : visibleRows.length ? visibleRows.map(row => (
                <tr key={`${row.advertiserId}-${row.adTypeCode}`}>
                  <td>{displayName(row.advertiser)}</td>
                  <td>{displayName(row.adTypeName)}</td>
                  <td>{row.adTypeCode}</td>
                  <td className="amount-cell">{formatAmount(row.totalRevenue)}</td>
                  <td>{formatAmount(row.totalQty)}</td>
                  <td>{row.recordCount}</td>
                </tr>
              )) : <EmptyRow colSpan={6} />}
            </tbody>
            <tfoot>
              <tr className="report-total-row report-total-sticky">
                <td>{t('total')}</td>
                <td colSpan={2}></td>
                <td>{formatAmount(sumRows(visibleRows, row => row.totalRevenue))}</td>
                <td>{formatAmount(sumRows(visibleRows, row => row.totalQty))}</td>
                <td>{sumRows(visibleRows, row => row.recordCount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdvQuery() {
  const { t, displayName } = useAppContext();
  const [filters, setFilters] = React.useState({
    startDate: '',
    endDate: '',
    business: '',
    advertiser: '',
    adOrder: '',
    adId: '',
    type: '',
    rate: '',
    status: 'confirmed' as StatusFilter,
    search: '',
  });
  const [rows, setRows] = React.useState<AdvertiserEntryRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  // Use ref to keep latest rows available for deriving filter params
  // without causing unnecessary effect re-runs
  const rowsRef = React.useRef<AdvertiserEntryRow[]>([]);
  rowsRef.current = rows;

  const getReportParams = React.useCallback(() => {
    const rows = rowsRef.current;
    const advertiserId = filters.advertiser && rows.length > 0
      ? (() => { const match = rows.find(r => r.advertiser === filters.advertiser); return match?.advertiserId; })()
      : undefined;
    return {
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      status: statusParam(filters.status),
      advertiserId,
      adTypeCode: filters.adId || undefined,
    };
  }, [filters.startDate, filters.endDate, filters.status, filters.advertiser, filters.adId]);

  const loadAdvQueryRows = React.useCallback(() => {
    const params = getReportParams();
    const key = `${params.startDate ?? ''}:${params.endDate ?? ''}:${params.status}:${params.advertiserId ?? ''}:${params.adTypeCode ?? ''}`;
    const existing = advQueryInFlight.get(key);
    if (existing) return existing;
    const request = getAdvertiserReport(params).finally(() => {
      advQueryInFlight.delete(key);
    });
    advQueryInFlight.set(key, request);
    return request;
  }, [getReportParams]);

  React.useEffect(() => {
    if (!filters.startDate || !filters.endDate) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    loadAdvQueryRows()
      .then(data => {
        if (!cancelled) setRows(data);
      })
      .catch(err => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAdvQueryRows]);

  const orderCodeForAdvRow = (row: AdvertiserEntryRow) => row.adOrderCode ?? row.adOrder;

  const visibleRows = sortRowsByDate(rows.filter(row =>
    (!filters.business || orderCodeForAdvRow(row) === filters.business)
    && (!filters.advertiser || row.advertiser === filters.advertiser)
    && (!filters.adOrder || row.adOrder === filters.adOrder)
    && (!filters.adId || row.adId === filters.adId)
    && (!filters.type || row.type === filters.type)
    && (!filters.rate || row.rate === filters.rate)
    && matchesStatus(row.status, filters.status)
    && matchesLocalized(displayName, filters.search, [row.advertiser, row.adOrder, row.adId, row.type])
  ), ['advertiser', 'adOrder', 'adId']);
  const businessRows = filters.business ? rows.filter(row => orderCodeForAdvRow(row) === filters.business) : rows;
  const businessOptions = businessOptionsFromRows(rows, orderCodeForAdvRow);

  const columns: CsvColumn<AdvertiserEntryRow>[] = [
    { label: t('date'), value: row => row.date },
    { label: t('advertiser'), value: row => displayName(row.advertiser) },
    { label: t('adOrder'), value: row => displayName(orderCodeForAdvRow(row)) },
    { label: t('type'), value: row => row.type },
    { label: t('adId'), value: row => row.adId },
    { label: t('unitPriceRevenueShare'), value: row => row.rate },
    { label: t('trafficData'), value: row => row.traffic },
    { label: t('settlementOrAdvertiserAmount'), value: row => row.settlement },
    { label: t('receivableAmount'), value: row => formatAmount(row.receivable) },
    { label: t('status'), value: row => row.status === 'confirmed' ? t('confirmed') : t('pendingConfirm') },
  ];

  const update = (key: keyof typeof filters, value: string) => setFilters(prev => {
    if (key === 'business') return { ...prev, business: value, advertiser: '', adOrder: '', adId: '', type: '', rate: '' };
    return { ...prev, [key]: value };
  });

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pAdvQuery')}</h1></div>
      <div className="card report-card report-table-card adv-query-card">
        <div className="report-toolbar">
          <div className="report-toolbar-left">
            <ReportDateRangeField
              startValue={filters.startDate}
              endValue={filters.endDate}
              onStartChange={value => update('startDate', value)}
              onEndChange={value => update('endDate', value)}
              placeholder={t('date')}
            />
          </div>
          <div className="report-toolbar-right">
            <ReportBusinessSelect value={filters.business} onChange={value => update('business', value)} options={businessOptions} />
            <select className="report-control report-select" value={filters.advertiser} onChange={event => update('advertiser', event.target.value)}><option value="">{t('advertiser')}</option>{unique(businessRows.map(row => row.advertiser)).map(value => <option key={value} value={value}>{displayName(value)}</option>)}</select>
            <select className="report-control report-select" value={filters.adOrder} onChange={event => update('adOrder', event.target.value)}><option value="">{t('adOrder')}</option>{unique(businessRows.map(row => row.adOrder)).map(value => <option key={value} value={value}>{displayName(value)}</option>)}</select>
            <select className="report-control report-select" value={filters.adId} onChange={event => update('adId', event.target.value)}><option value="">{t('adId')}</option>{unique(businessRows.map(row => row.adId)).map(value => <option key={value} value={value}>{value}</option>)}</select>
            <select className="report-control report-select report-select-small" value={filters.type} onChange={event => update('type', event.target.value)}><option value="">{t('type')}</option><option value="CPM">CPM</option><option value="CPS">CPS</option><option value="CPA">CPA</option></select>
            <select className="report-control report-select report-rate-select" value={filters.rate} onChange={event => update('rate', event.target.value)}>
              <option value="">{t('unitPriceRevenueShare')}</option>
              {unique(businessRows.map(row => row.rate)).map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <select className="report-control report-select report-status-select" value={filters.status} onChange={event => update('status', event.target.value)}>
              <option value="">{t('status')}</option>
              <option value="all">{t('allStatuses')}</option>
              <option value="confirmed">{t('confirmed')}</option>
              <option value="pendingConfirm">{t('pendingConfirm')}</option>
            </select>
            <ReportSearchField placeholder={compactSearchPlaceholder(t('search'))} value={filters.search} onChange={value => update('search', value)} />
            <DownloadButton onClick={() => downloadCsv('广告主数据查询.csv', columns, visibleRows)} />
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="table-wrap report-table-wrap report-table-scroll">
          <table className="report-table query-report-table">
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
              </tr>
            </thead>
            <tbody>
              {loading ? <LoadingRow colSpan={10} /> : visibleRows.length ? visibleRows.map(row => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{displayName(row.advertiser)}</td>
                  <td>{displayName(row.adOrder)}</td>
                  <td>{row.type}</td>
                  <td>{row.adId}</td>
                  <td>{row.rate}</td>
                  <td>{row.traffic || '--'}</td>
                  <td>{row.settlement || '--'}</td>
                  <td className="amount-cell">{formatAmount(row.receivable)}</td>
                  <td><StatusBadge status={row.status} /></td>
                </tr>
              )) : <EmptyRow colSpan={10} />}
            </tbody>
            <tfoot>
              <tr className="report-total-row report-total-sticky">
                <td>{t('total')}</td>
                <td colSpan={7}></td>
                <td>{formatAmount(sumRows(visibleRows, row => row.receivable))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export function MediaQuery() {
  const { t, displayName } = useAppContext();
  const [filters, setFilters] = React.useState({
    startDate: '',
    endDate: '',
    business: '',
    media: '',
    mediaAdOrder: '',
    mediaId: '',
    type: '',
    rate: '',
    shareRatio: '',
    status: 'confirmed' as StatusFilter,
    search: '',
  });
  const [rows, setRows] = React.useState<MediaEntryRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  // Use ref to keep latest rows available for deriving filter params
  // without causing unnecessary effect re-runs
  const rowsRef = React.useRef<MediaEntryRow[]>([]);
  rowsRef.current = rows;

  const getReportParams = React.useCallback(() => {
    const rows = rowsRef.current;
    const mediaId = filters.media && rows.length > 0
      ? (() => { const match = rows.find(r => r.media === filters.media); return match?.mediaId; })()
      : undefined;
    return {
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      status: statusParam(filters.status),
      mediaId,
      adTypeCode: filters.mediaId || undefined,
    };
  }, [filters.startDate, filters.endDate, filters.status, filters.media, filters.mediaId]);

  const loadMediaQueryRows = React.useCallback(() => {
    const params = getReportParams();
    const key = `${params.startDate ?? ''}:${params.endDate ?? ''}:${params.status}:${params.mediaId ?? ''}:${params.adTypeCode ?? ''}`;
    const existing = mediaQueryInFlight.get(key);
    if (existing) return existing;
    const request = getMediaReport(params).finally(() => {
      mediaQueryInFlight.delete(key);
    });
    mediaQueryInFlight.set(key, request);
    return request;
  }, [getReportParams]);

  React.useEffect(() => {
    if (!filters.startDate || !filters.endDate) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    loadMediaQueryRows()
      .then(data => {
        if (!cancelled) setRows(data);
      })
      .catch(err => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadMediaQueryRows]);

  const orderCodeForMediaRow = (row: MediaEntryRow) => row.mediaAdOrderCode ?? row.mediaAdOrder;

  const visibleRows = sortRowsByDate(rows.filter(row =>
    (!filters.business || orderCodeForMediaRow(row) === filters.business)
    && (!filters.media || row.media === filters.media)
    && (!filters.mediaAdOrder || row.mediaAdOrder === filters.mediaAdOrder)
    && (!filters.mediaId || row.mediaIdStr === filters.mediaId)
    && (!filters.type || row.type === filters.type)
    && (!filters.rate || row.rate === filters.rate)
    && (!filters.shareRatio || row.shareRatio === filters.shareRatio)
    && matchesStatus(row.status, filters.status)
    && matchesLocalized(displayName, filters.search, [row.media, row.mediaAdOrder, row.mediaIdStr, row.type])
  ), ['media', 'mediaAdOrder', 'mediaIdStr']);
  const businessRows = filters.business ? rows.filter(row => orderCodeForMediaRow(row) === filters.business) : rows;
  const businessOptions = businessOptionsFromRows(rows, orderCodeForMediaRow);

  const columns: CsvColumn<MediaEntryRow>[] = [
    { label: t('date'), value: row => row.date },
    { label: t('media'), value: row => displayName(row.media) },
    { label: t('mediaAdOrder'), value: row => displayName(orderCodeForMediaRow(row)) },
    { label: t('type'), value: row => row.type },
    { label: t('mediaId'), value: row => row.mediaIdStr },
    { label: t('unitPriceRevenueShare'), value: row => row.rate },
    { label: t('trafficData'), value: row => row.traffic },
    { label: t('settlementOrAdvertiserAmount'), value: row => row.settlement },
    { label: t('dataCoefficient'), value: row => row.dataCoefficient },
    { label: t('receivableAmount'), value: row => formatAmount(row.receivable) },
    { label: t('shareRatio'), value: row => row.shareRatio },
    { label: t('actualReceivedAmount'), value: row => formatAmount(row.actualReceived) },
    { label: t('status'), value: row => row.status === 'confirmed' ? t('confirmed') : t('pendingConfirm') },
  ];

  const update = (key: keyof typeof filters, value: string) => setFilters(prev => {
    if (key === 'business') return { ...prev, business: value, media: '', mediaAdOrder: '', mediaId: '', type: '', rate: '', shareRatio: '' };
    return { ...prev, [key]: value };
  });

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('pMediaQuery')}</h1></div>
      <div className="card report-card report-table-card media-query-card">
        <div className="report-toolbar">
          <div className="report-toolbar-left">
            <ReportDateRangeField
              startValue={filters.startDate}
              endValue={filters.endDate}
              onStartChange={value => update('startDate', value)}
              onEndChange={value => update('endDate', value)}
              placeholder={t('date')}
            />
          </div>
          <div className="report-toolbar-right">
            <ReportBusinessSelect value={filters.business} onChange={value => update('business', value)} options={businessOptions} />
            <select className="report-control report-select" value={filters.media} onChange={event => update('media', event.target.value)}><option value="">{t('media')}</option>{unique(businessRows.map(row => row.media)).map(value => <option key={value} value={value}>{displayName(value)}</option>)}</select>
            <select className="report-control report-select" value={filters.mediaAdOrder} onChange={event => update('mediaAdOrder', event.target.value)}><option value="">{t('mediaAdOrder')}</option>{unique(businessRows.map(row => row.mediaAdOrder)).map(value => <option key={value} value={value}>{displayName(value)}</option>)}</select>
            <select className="report-control report-select" value={filters.mediaId} onChange={event => update('mediaId', event.target.value)}><option value="">{t('mediaId')}</option>{unique(businessRows.map(row => row.mediaIdStr)).map(value => <option key={value} value={value}>{value}</option>)}</select>
            <select className="report-control report-select report-select-small" value={filters.type} onChange={event => update('type', event.target.value)}><option value="">{t('type')}</option><option value="CPM">CPM</option><option value="CPS">CPS</option><option value="CPA">CPA</option></select>
            <select className="report-control report-select report-rate-select" value={filters.rate} onChange={event => update('rate', event.target.value)}>
              <option value="">{t('unitPriceRevenueShare')}</option>
              {unique(businessRows.map(row => row.rate)).map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <select className="report-control report-select report-share-select" value={filters.shareRatio} onChange={event => update('shareRatio', event.target.value)}>
              <option value="">{t('shareRatio')}</option>
              {unique(businessRows.map(row => row.shareRatio)).map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <select className="report-control report-select report-status-select" value={filters.status} onChange={event => update('status', event.target.value)}>
              <option value="">{t('status')}</option>
              <option value="all">{t('allStatuses')}</option>
              <option value="confirmed">{t('confirmed')}</option>
              <option value="pendingConfirm">{t('pendingConfirm')}</option>
            </select>
            <ReportSearchField placeholder={compactSearchPlaceholder(t('search'))} value={filters.search} onChange={value => update('search', value)} />
            <DownloadButton onClick={() => downloadCsv('媒体数据查询.csv', columns, visibleRows)} />
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="table-wrap report-table-wrap report-table-scroll">
          <table className="report-table media-query-table">
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
              </tr>
            </thead>
            <tbody>
              {loading ? <LoadingRow colSpan={13} /> : visibleRows.length ? visibleRows.map(row => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{displayName(row.media)}</td>
                  <td>{displayName(row.mediaAdOrder)}</td>
                  <td>{row.type}</td>
                  <td>{row.mediaIdStr}</td>
                  <td>{row.rate}</td>
                  <td>{row.traffic || '--'}</td>
                  <td>{row.settlement || '--'}</td>
                  <td>{row.dataCoefficient || '--'}</td>
                  <td className="amount-cell">{formatAmount(row.receivable)}</td>
                  <td>{row.shareRatio || '--'}</td>
                  <td className="amount-cell">{formatAmount(row.actualReceived)}</td>
                  <td><StatusBadge status={row.status} /></td>
                </tr>
              )) : <EmptyRow colSpan={13} />}
            </tbody>
            <tfoot>
              <tr className="report-total-row report-total-sticky">
                <td>{t('total')}</td>
                <td colSpan={10}></td>
                <td>{formatAmount(sumRows(visibleRows, row => row.actualReceived))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
