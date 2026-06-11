import React from 'react';
import { CalendarDays, Search } from 'lucide-react';
import { useAppContext } from '../AppContext';
import {
  getAdvertiserReport,
  getMediaReport,
  getOrderProfitReport,
  getTotalProfitReport,
  listAdvertisers,
  listAdOrders,
} from '../lib/bffApi';
import type {
  AdvertiserEntryRow,
  MediaEntryRow,
  OrderProfitReportRow,
  ReportStatusParam,
  TotalProfitReportRow,
} from '../lib/bffTypes';
import { PageHeader } from '../components/common/PageHeader';
import { uiTypeToApiType } from '../lib/bffTypes';
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

function billingMethodLabel(type: string) {
  return type === 'RATIO' ? 'CPS' : type;
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
  validation,
  onClear,
  onPreset,
}: {
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  placeholder: string;
  validation?: string;
  onClear?: () => void;
  onPreset?: (label: 'thisMonth' | 'lastMonth') => void;
}) {
  // Unified event handler: works for onChange, onInput, onBlur from <input>
  function handleStart(e: React.ChangeEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) {
    const target = e.target as HTMLInputElement;
    onStartChange(target.value);
  }
  function handleEnd(e: React.ChangeEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) {
    const target = e.target as HTMLInputElement;
    onEndChange(target.value);
  }

  return (
    <div className="report-date-range-field">
      <span className="report-date-range-label">{placeholder}</span>
      <div className="report-date-range-inputs">
        <input
          type="date"
          value={startValue}
          aria-label={`${placeholder} start`}
          onChange={handleStart}
          onInput={handleStart}
          onBlur={handleStart}
        />
        <span className="report-date-range-sep">—</span>
        <input
          type="date"
          value={endValue}
          aria-label={`${placeholder} end`}
          onChange={handleEnd}
          onInput={handleEnd}
          onBlur={handleEnd}
        />
      </div>
      {onPreset && (
        <div className="report-date-range-presets">
          <button type="button" className="report-date-preset-btn" onClick={() => onPreset('thisMonth')}>Tháng này</button>
          <button type="button" className="report-date-preset-btn" onClick={() => onPreset('lastMonth')}>Tháng trước</button>
        </div>
      )}
      {onClear && (startValue || endValue) && (
        <button type="button" className="report-date-range-clear" onClick={onClear} title="Clear dates">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
      {validation && (
        <span className="report-date-range-validation">{validation}</span>
      )}
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

  const dateValidation = startDate && endDate && startDate > endDate
    ? 'Từ ngày không được lớn hơn Đến ngày'
    : undefined;

  const handleClearDates = () => {
    setStartDate('');
    setEndDate('');
  };

  React.useEffect(() => {
    if (!startDate || !endDate || dateValidation) {
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
  }, [startDate, endDate, dateValidation]);

  const totalRow = rows.find(row => row.date.endsWith('-total'));
  const dailyRows = rows.filter(row => !row.date.endsWith('-total'));
  const visibleRows = dailyRows.filter(row =>
    matchesLocalized(displayName, search, [row.date, row.revenue, row.cost, row.profit])
  );

  const columns: CsvColumn<TotalProfitReportRow>[] = [
    { label: t('date'), value: row => row.date },
    { label: t('revenue'), value: row => formatAmount(row.revenue) },
    { label: t('expense'), value: row => formatAmount(row.cost) },
    { label: t('taxAmount'), value: row => formatAmount(row.tax) },
    { label: t('profit'), value: row => formatAmount(row.profit) },
    { label: t('profitMargin'), value: row => formatPercent(row.profitRate) },
  ];

  const exportRows = totalRow ? [...visibleRows, totalRow] : visibleRows;

  return (
    <div className="page active">
      <PageHeader eyebrow={t('report') || 'Report'} title={t('pTotalProfit')} description={startDate && endDate ? `${startDate} - ${endDate}` : t('date')} />
      <div className="card report-card report-table-card total-profit-card">
        <div className="report-toolbar">
          <div className="report-toolbar-left">
            <ReportDateRangeField
              startValue={startDate}
              endValue={endDate}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
              placeholder={t('date')}
              validation={dateValidation}
              onClear={handleClearDates}
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
                <th>{t('expense')}</th>
                <th>{t('taxAmount')}</th>
                <th>{t('profit')}</th>
                <th>{t('profitMargin')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <LoadingRow colSpan={6} /> : visibleRows.length ? visibleRows.map(row => (
                <tr key={`${row.date}-${row.upstreamId}`}>
                  <td>{row.date}</td>
                  <td className="amount-cell">{formatAmount(row.revenue)}</td>
                  <td>{formatAmount(row.cost)}</td>
                  <td>{formatAmount(row.tax)}</td>
                  <td className="amount-cell">{formatAmount(row.profit)}</td>
                  <td>{formatPercent(row.profitRate)}</td>
                </tr>
              )) : <EmptyRow colSpan={6} />}
            </tbody>
            {totalRow && (
              <tfoot>
                <tr className="report-total-row report-total-sticky">
                  <td>{t('total')}</td>
                  <td>{formatAmount(totalRow.revenue)}</td>
                  <td>{formatAmount(totalRow.cost)}</td>
                  <td>{formatAmount(totalRow.tax)}</td>
                  <td>{formatAmount(totalRow.profit)}</td>
                  <td>{formatPercent(totalRow.profitRate)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function thisMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate: firstDay, endDate };
}

function lastMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}

export function OrderProfit() {
  const { t, displayName } = useAppContext();
  const [draftStartDate, setDraftStartDate] = React.useState('');
  const [draftEndDate, setDraftEndDate] = React.useState('');
  const [draftBillingMethod, setDraftBillingMethod] = React.useState('');
  const [draftSearch, setDraftSearch] = React.useState('');
  const [appliedStartDate, setAppliedStartDate] = React.useState('');
  const [appliedEndDate, setAppliedEndDate] = React.useState('');
  const [appliedBillingMethod, setAppliedBillingMethod] = React.useState('');
  const [rows, setRows] = React.useState<OrderProfitReportRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isDirty, setIsDirty] = React.useState(false);

  const [dateWarning, setDateWarning] = React.useState<string | null>(null);

  const dateValidation = draftStartDate && draftEndDate && draftStartDate > draftEndDate
    ? 'Ngày bắt đầu không được lớn hơn ngày kết thúc.'
    : null;

  const handleClearDates = () => {
    setDraftStartDate('');
    setDraftEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setIsDirty(false);
    setDateWarning(null);
  };

  const handleQuery = React.useCallback(() => {
    if (!draftStartDate || !draftEndDate) {
      setDateWarning('Vui lòng chọn khoảng ngày trước khi truy vấn.');
      return;
    }
    if (dateValidation) return;
    setDateWarning(null);
    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
    setAppliedBillingMethod(draftBillingMethod);
    setIsDirty(false);
    let cancelled = false;
    setLoading(true);
    setError('');
    getOrderProfitReport({
      startDate: draftStartDate,
      endDate: draftEndDate,
      billingMethod: draftBillingMethod ? uiTypeToApiType(draftBillingMethod as 'CPM' | 'CPA' | 'CPS') : undefined,
    })
      .then(data => {
        if (!cancelled) setRows(data);
      })
      .catch(err => {
        if (!cancelled) setError('Không thể tải dữ liệu. Vui lòng kiểm tra kết nối hoặc đăng nhập lại.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
  }, [draftStartDate, draftEndDate, draftBillingMethod, dateValidation]);

  // Mark dirty when any filter changes
  function handleFilterChange() {
    setIsDirty(true);
  }

  function handleBillingMethodChange(val: string) {
    setDraftBillingMethod(val);
    handleFilterChange();
  }

  function handleSearchChange(val: string) {
    setDraftSearch(val);
    // Search is local-only, not a query param — no dirty flag needed
  }

  function handlePreset(label: 'thisMonth' | 'lastMonth') {
    const range = label === 'thisMonth' ? thisMonthRange() : lastMonthRange();
    setDraftStartDate(range.startDate);
    setDraftEndDate(range.endDate);
    if (appliedStartDate) handleFilterChange();
  }

  const visibleRows = rows.filter(row =>
    matchesLocalized(displayName, draftSearch, [row.advertiser, row.adTypeCode, row.adTypeName])
  );

  const billingMethodOptions = [
    { value: 'CPM', label: 'CPM' },
    { value: 'CPA', label: 'CPA' },
    { value: 'CPS', label: 'CPS' },
  ];

  const columns: CsvColumn<OrderProfitReportRow>[] = [
    { label: t('date'), value: row => row.date },
    { label: t('advertiser'), value: row => displayName(row.advertiser) },
    { label: t('adOrder'), value: row => displayName(row.adTypeName) },
    { label: t('billingMethod'), value: row => billingMethodLabel(row.billingMethod) },
    { label: t('revenue'), value: row => formatAmount(row.revenue) },
    { label: t('trafficData'), value: row => formatAmount(row.qty) },
    { label: 'Records', value: row => row.recordCount },
  ];

  return (
    <div className="page active">
      <PageHeader eyebrow={t('report') || 'Report'} title={t('pOrderProfit')} description={appliedStartDate && appliedEndDate ? `${appliedStartDate} - ${appliedEndDate}` : t('date')} />
      <div className="card report-card report-table-card order-profit-card">
        <div className="report-toolbar">
          <div className="report-toolbar-left">
            <ReportDateRangeField
              startValue={draftStartDate}
              endValue={draftEndDate}
              onStartChange={v => { setDraftStartDate(v); setDateWarning(null); handleFilterChange(); }}
              onEndChange={v => { setDraftEndDate(v); setDateWarning(null); handleFilterChange(); }}
              placeholder={t('date')}
              validation={dateValidation}
              onClear={handleClearDates}
              onPreset={handlePreset}
            />
          </div>
          <div className="report-toolbar-right">
            <div className="report-business-control" aria-label={t('billingMethod')}>
              <span className="report-business-label">{t('billingMethod')}</span>
              <select
                className="report-control report-select report-business-select"
                value={draftBillingMethod}
                onChange={e => handleBillingMethodChange(e.target.value)}
                aria-label={t('billingMethod')}
              >
                <option value="">{t('all')}</option>
                {billingMethodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <ReportSearchField placeholder={t('searchName')} value={draftSearch} onChange={handleSearchChange} />
            <button
              type="button"
              className="btn-primary report-download-btn data-download-btn"
              onClick={handleQuery}
              disabled={!!dateValidation}
              title={t('query')}
            >
              {t('query') || 'Truy vấn'}
            </button>
            <button
              type="button"
              className="btn-primary report-download-btn data-download-btn"
              onClick={() => downloadCsv('广告单利润表.csv', columns, visibleRows)}
              title={isDirty ? (t('exportDirtyWarning') || 'Filters changed. Click Query first.') : t('dataDownload')}
              disabled={isDirty || !appliedStartDate}
            >
              {t('exportExcel') || 'Xuất Excel'}
            </button>
          </div>
        </div>
        {isDirty && appliedStartDate && (
          <div className="form-note">{t('filterDirtyWarning') || 'Bộ lọc đã thay đổi. Vui lòng bấm Truy vấn để cập nhật kết quả.'}</div>
        )}
        {dateWarning && <div className="form-note">{dateWarning}</div>}
        {error && <div className="form-error">{error}</div>}
        <div className="table-wrap report-table-wrap report-table-scroll">
          <table className="report-table">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('advertiser')}</th>
                <th>{t('adOrder')}</th>
                <th>{t('billingMethod')}</th>
                <th>{t('revenue')}</th>
                <th>{t('trafficData')}</th>
                <th>Records</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <LoadingRow colSpan={7} /> : visibleRows.length ? visibleRows.map(row => (
                <tr key={`${row.date}-${row.advertiserId}-${row.billingMethod}`}>
                  <td>{row.date}</td>
                  <td>{displayName(row.advertiser)}</td>
                  <td>{displayName(row.adTypeName)}</td>
                  <td>{billingMethodLabel(row.billingMethod)}</td>
                  <td className="amount-cell">{formatAmount(row.revenue)}</td>
                  <td>{formatAmount(row.qty)}</td>
                  <td>{row.recordCount}</td>
                </tr>
              )) : !appliedStartDate ? (
                <tr><td colSpan={7} className="empty-state-text">Chọn khoảng ngày rồi bấm Truy vấn để xem dữ liệu.</td></tr>
              ) : (
                <tr><td colSpan={7} className="empty-state-text">Không có dữ liệu trong khoảng ngày/bộ lọc đã chọn.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="report-total-row report-total-sticky">
                <td>{t('total')}</td>
                <td colSpan={3}></td>
                <td>{formatAmount(sumRows(visibleRows, row => row.revenue))}</td>
                <td>{formatAmount(sumRows(visibleRows, row => row.qty))}</td>
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
  const [advertisers, setAdvertisers] = React.useState<{ id: number; name: string }[]>([]);
  const [adTypes, setAdTypes] = React.useState<{ code: string; name: string }[]>([]);

  const [draftFilters, setDraftFilters] = React.useState({
    startDate: '',
    endDate: '',
    business: '',
    advertiserId: '' as string | number,
    adOrder: '',
    adId: '',
    type: '',
    rate: '',
    status: 'confirmed' as StatusFilter,
    search: '',
  });
  const [appliedFilters, setAppliedFilters] = React.useState({ ...draftFilters });
  const [rows, setRows] = React.useState<AdvertiserEntryRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isDirty, setIsDirty] = React.useState(false);
  const [dateWarning, setDateWarning] = React.useState<string | null>(null);

  const dateValidation = draftFilters.startDate && draftFilters.endDate && draftFilters.startDate > draftFilters.endDate
    ? 'Ngày bắt đầu không được lớn hơn ngày kết thúc.'
    : null;

  // Load advertiser and ad type master data once
  React.useEffect(() => {
    listAdvertisers().then(data => setAdvertisers(data.map(a => ({ id: a.id, name: a.name })))).catch(() => {});
    import('../lib/bffApi').then(m => m.listAdTypes ? m.listAdTypes() : Promise.resolve([])).then((data: unknown) => setAdTypes((data as { code: string; name: string }[]) ?? [])).catch(() => {});
  }, []);

  const getReportParams = React.useCallback(() => ({
    startDate: appliedFilters.startDate || undefined,
    endDate: appliedFilters.endDate || undefined,
    status: statusParam(appliedFilters.status),
    advertiserId: appliedFilters.advertiserId ? Number(appliedFilters.advertiserId) : undefined,
    adTypeCode: appliedFilters.business || undefined,
  }), [appliedFilters.startDate, appliedFilters.endDate, appliedFilters.status, appliedFilters.advertiserId, appliedFilters.business]);

  const loadAdvQueryRows = React.useCallback(() => {
    const params = getReportParams();
    return getAdvertiserReport(params);
  }, [getReportParams]);

  const handleQuery = React.useCallback(() => {
    if (!draftFilters.startDate || !draftFilters.endDate) {
      setDateWarning('Vui lòng chọn khoảng ngày trước khi truy vấn.');
      return;
    }
    if (dateValidation) return;
    setDateWarning(null);
    setAppliedFilters(draftFilters);
    setIsDirty(false);
    let cancelled = false;
    setLoading(true);
    setError('');
    loadAdvQueryRows()
      .then(data => { if (!cancelled) setRows(data); })
      .catch(err => { if (!cancelled) setError('Không thể tải dữ liệu. Vui lòng kiểm tra kết nối hoặc đăng nhập lại.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
  }, [draftFilters, dateValidation, loadAdvQueryRows]);

  function handleFilterChange() { setIsDirty(true); }

  function handlePreset(label: 'thisMonth' | 'lastMonth') {
    const range = label === 'thisMonth' ? thisMonthRange() : lastMonthRange();
    setDraftFilters(prev => ({ ...prev, startDate: range.startDate, endDate: range.endDate }));
    if (appliedFilters.startDate) handleFilterChange();
  }

  function update(key: keyof typeof draftFilters, value: string) {
    setDraftFilters(prev => {
      if (key === 'business') return { ...prev, business: value, advertiserId: '', adOrder: '', adId: '', type: '', rate: '' };
      if (key === 'advertiserId') return { ...prev, advertiserId: value, adOrder: '', adId: '' };
      if (key === 'startDate' || key === 'endDate') return { ...prev, [key]: value };
      return { ...prev, [key]: value };
    });
    setDateWarning(null);
    handleFilterChange();
  }

  const handleClearDates = () => { setDraftFilters(prev => ({ ...prev, startDate: '', endDate: '' })); setAppliedFilters(prev => ({ ...prev, startDate: '', endDate: '' })); setIsDirty(false); setDateWarning(null); };

  const visibleRows = rows.filter(row =>
    (!draftFilters.business || row.adOrderCode === draftFilters.business || row.adOrder === draftFilters.business)
    && (!draftFilters.advertiserId || row.advertiserId === Number(draftFilters.advertiserId))
    && (!draftFilters.adOrder || row.adOrder === draftFilters.adOrder)
    && (!draftFilters.adId || row.adId === draftFilters.adId)
    && (!draftFilters.type || row.type === draftFilters.type)
    && (!draftFilters.rate || row.rate === draftFilters.rate)
    && matchesStatus(row.status, draftFilters.status)
    && matchesLocalized(displayName, draftFilters.search, [row.advertiser, row.adOrder, row.adId, row.type])
  );

  const orderCodeForAdvRow = (row: AdvertiserEntryRow) => row.adOrderCode ?? row.adOrder;
  const orderNameForAdvRow = (row: AdvertiserEntryRow) => {
    const name = (row.adOrderName ?? '').trim();
    return name || orderCodeForAdvRow(row);
  };

  const columns: CsvColumn<AdvertiserEntryRow>[] = [
    { label: t('date'), value: row => row.date },
    { label: t('advertiser'), value: row => displayName(row.advertiser) },
    { label: t('adOrder'), value: row => displayName(orderNameForAdvRow(row)) },
    { label: t('type'), value: row => row.type },
    { label: t('adId'), value: row => row.adId },
    { label: t('unitPriceRevenueShare'), value: row => row.rate },
    { label: t('trafficData'), value: row => row.traffic },
    { label: t('settlementOrAdvertiserAmount'), value: row => row.settlement },
    { label: t('receivableAmount'), value: row => formatAmount(row.receivable) },
    { label: t('status'), value: row => row.status === 'confirmed' ? t('confirmed') : t('pendingConfirm') },
  ];

  const businessOptions = adTypes.map(at => ({ value: at.code, label: at.name }));

  return (
    <div className="page active">
      <PageHeader eyebrow={t('report') || 'Report'} title={t('pAdvQuery')} description={appliedFilters.startDate && appliedFilters.endDate ? `${appliedFilters.startDate} - ${appliedFilters.endDate}` : t('date')} />
      <div className="card report-card report-table-card adv-query-card">
        <div className="report-toolbar">
          <div className="report-toolbar-left">
            <ReportDateRangeField
              startValue={draftFilters.startDate}
              endValue={draftFilters.endDate}
              onStartChange={value => update('startDate', value)}
              onEndChange={value => update('endDate', value)}
              placeholder={t('date')}
              validation={dateValidation}
              onClear={handleClearDates}
              onPreset={handlePreset}
            />
          </div>
          <div className="report-toolbar-right">
            <ReportBusinessSelect value={draftFilters.business} onChange={value => update('business', value)} options={businessOptions} />
            <select className="report-control report-select" value={String(draftFilters.advertiserId)} onChange={event => update('advertiserId', event.target.value)}><option value="">{t('advertiser')}</option>{advertisers.map(a => <option key={a.id} value={String(a.id)}>{displayName(a.name)}</option>)}</select>
            <ReportSearchField placeholder={compactSearchPlaceholder(t('search'))} value={draftFilters.search} onChange={value => { setDraftFilters(prev => ({ ...prev, search: value })); }} />
            <select className="report-control report-select report-select-small" value={draftFilters.type} onChange={event => update('type', event.target.value)}><option value="">{t('type')}</option><option value="CPM">CPM</option><option value="CPS">CPS</option><option value="CPA">CPA</option></select>
            <select className="report-control report-select report-status-select" value={draftFilters.status} onChange={event => update('status', event.target.value)}>
              <option value="">{t('status')}</option>
              <option value="all">{t('allStatuses')}</option>
              <option value="confirmed">{t('confirmed')}</option>
              <option value="pendingConfirm">{t('pendingConfirm')}</option>
            </select>
            <button
              type="button"
              className="btn-primary report-download-btn data-download-btn"
              onClick={handleQuery}
              disabled={!!dateValidation}
              title={t('query')}
            >
              {t('query') || 'Truy vấn'}
            </button>
            <button
              type="button"
              className="btn-primary report-download-btn data-download-btn"
              onClick={() => downloadCsv('广告主数据查询.csv', columns, visibleRows)}
              title={isDirty ? (t('exportDirtyWarning') || 'Filters changed. Click Query first.') : t('dataDownload')}
              disabled={isDirty || !appliedFilters.startDate}
            >
              {t('exportExcel') || 'Xuất Excel'}
            </button>
          </div>
        </div>
        {isDirty && appliedFilters.startDate && (
          <div className="form-note">Bộ lọc đã thay đổi. Vui lòng bấm Truy vấn để cập nhật kết quả.</div>
        )}
        {dateWarning && <div className="form-note">{dateWarning}</div>}
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
                  <td>{displayName(orderNameForAdvRow(row))}</td>
                  <td>{row.type}</td>
                  <td>{row.adId}</td>
                  <td>{row.rate}</td>
                  <td>{row.traffic || '--'}</td>
                  <td>{row.settlement || '--'}</td>
                  <td className="amount-cell">{formatAmount(row.receivable)}</td>
                  <td><StatusBadge status={row.status} /></td>
                </tr>
              )) : !appliedFilters.startDate ? (
                <tr><td colSpan={10} className="empty-state-text">Chọn khoảng ngày rồi bấm Truy vấn để xem dữ liệu.</td></tr>
              ) : (
                <tr><td colSpan={10} className="empty-state-text">Không có dữ liệu trong khoảng ngày/bộ lọc đã chọn.</td></tr>
              )}
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
  const [mediaList, setMediaList] = React.useState<{ id: number; name: string }[]>([]);
  const [adTypes, setAdTypes] = React.useState<{ code: string; name: string }[]>([]);

  const [draftFilters, setDraftFilters] = React.useState({
    startDate: '',
    endDate: '',
    business: '',
    mediaId: '' as string | number,
    mediaAdOrder: '',
    mediaIdStr: '',
    type: '',
    rate: '',
    shareRatio: '',
    status: 'confirmed' as StatusFilter,
    search: '',
  });
  const [appliedFilters, setAppliedFilters] = React.useState({ ...draftFilters });
  const [rows, setRows] = React.useState<MediaEntryRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isDirty, setIsDirty] = React.useState(false);
  const [dateWarning, setDateWarning] = React.useState<string | null>(null);

  const dateValidation = draftFilters.startDate && draftFilters.endDate && draftFilters.startDate > draftFilters.endDate
    ? 'Ngày bắt đầu không được lớn hơn ngày kết thúc.'
    : null;

  // Load media and ad type master data once
  React.useEffect(() => {
    import('../lib/bffApi').then(m => m.listMedia ? m.listMedia() : Promise.resolve([])).then((data: unknown) => setMediaList((data as { id: number; name: string }[]) ?? [])).catch(() => {});
    import('../lib/bffApi').then(m => m.listAdTypes ? m.listAdTypes() : Promise.resolve([])).then((data: unknown) => setAdTypes((data as { code: string; name: string }[]) ?? [])).catch(() => {});
  }, []);

  const getReportParams = React.useCallback(() => ({
    startDate: appliedFilters.startDate || undefined,
    endDate: appliedFilters.endDate || undefined,
    status: statusParam(appliedFilters.status),
    mediaId: appliedFilters.mediaId ? Number(appliedFilters.mediaId) : undefined,
    adTypeCode: appliedFilters.business || undefined,
  }), [appliedFilters.startDate, appliedFilters.endDate, appliedFilters.status, appliedFilters.mediaId, appliedFilters.business]);

  const loadMediaQueryRows = React.useCallback(() => {
    const params = getReportParams();
    return getMediaReport(params);
  }, [getReportParams]);

  const handleQuery = React.useCallback(() => {
    if (!draftFilters.startDate || !draftFilters.endDate) {
      setDateWarning('Vui lòng chọn khoảng ngày trước khi truy vấn.');
      return;
    }
    if (dateValidation) return;
    setDateWarning(null);
    setAppliedFilters(draftFilters);
    setIsDirty(false);
    let cancelled = false;
    setLoading(true);
    setError('');
    loadMediaQueryRows()
      .then(data => { if (!cancelled) setRows(data); })
      .catch(err => { if (!cancelled) setError('Không thể tải dữ liệu. Vui lòng kiểm tra kết nối hoặc đăng nhập lại.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
  }, [draftFilters, dateValidation, loadMediaQueryRows]);

  function handleFilterChange() { setIsDirty(true); }

  function handlePreset(label: 'thisMonth' | 'lastMonth') {
    const range = label === 'thisMonth' ? thisMonthRange() : lastMonthRange();
    setDraftFilters(prev => ({ ...prev, startDate: range.startDate, endDate: range.endDate }));
    if (appliedFilters.startDate) handleFilterChange();
  }

  function update(key: keyof typeof draftFilters, value: string) {
    setDraftFilters(prev => {
      if (key === 'business') return { ...prev, business: value, mediaId: '', mediaAdOrder: '', mediaIdStr: '', type: '', rate: '', shareRatio: '' };
      if (key === 'mediaId') return { ...prev, mediaId: value, mediaAdOrder: '', mediaIdStr: '' };
      if (key === 'startDate' || key === 'endDate') return { ...prev, [key]: value };
      return { ...prev, [key]: value };
    });
    setDateWarning(null);
    handleFilterChange();
  }

  const handleClearDates = () => { setDraftFilters(prev => ({ ...prev, startDate: '', endDate: '' })); setAppliedFilters(prev => ({ ...prev, startDate: '', endDate: '' })); setIsDirty(false); setDateWarning(null); };

  const orderCodeForMediaRow = (row: MediaEntryRow) => row.mediaAdOrderCode ?? row.mediaAdOrder;
  const orderNameForMediaRow = (row: MediaEntryRow) => {
    const name = (row.mediaAdOrderName ?? '').trim();
    return name || orderCodeForMediaRow(row);
  };

  const visibleRows = rows.filter(row =>
    (!draftFilters.business || orderCodeForMediaRow(row) === draftFilters.business)
    && (!draftFilters.mediaId || row.mediaId === Number(draftFilters.mediaId))
    && (!draftFilters.mediaAdOrder || row.mediaAdOrder === draftFilters.mediaAdOrder)
    && (!draftFilters.mediaIdStr || row.mediaIdStr === draftFilters.mediaIdStr)
    && (!draftFilters.type || row.type === draftFilters.type)
    && (!draftFilters.rate || row.rate === draftFilters.rate)
    && (!draftFilters.shareRatio || row.shareRatio === draftFilters.shareRatio)
    && matchesStatus(row.status, draftFilters.status)
    && matchesLocalized(displayName, draftFilters.search, [row.media, row.mediaAdOrder, row.mediaIdStr, row.type])
  );

  const columns: CsvColumn<MediaEntryRow>[] = [
    { label: t('date'), value: row => row.date },
    { label: t('media'), value: row => displayName(row.media) },
    { label: t('mediaAdOrder'), value: row => displayName(orderNameForMediaRow(row)) },
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

  const businessOptions = adTypes.map(at => ({ value: at.code, label: at.name }));

  return (
    <div className="page active">
      <PageHeader eyebrow={t('report') || 'Report'} title={t('pMediaQuery')} description={appliedFilters.startDate && appliedFilters.endDate ? `${appliedFilters.startDate} - ${appliedFilters.endDate}` : t('date')} />
      <div className="card report-card report-table-card media-query-card">
        <div className="report-toolbar">
          <div className="report-toolbar-left">
            <ReportDateRangeField
              startValue={draftFilters.startDate}
              endValue={draftFilters.endDate}
              onStartChange={value => update('startDate', value)}
              onEndChange={value => update('endDate', value)}
              placeholder={t('date')}
              validation={dateValidation}
              onClear={handleClearDates}
              onPreset={handlePreset}
            />
          </div>
          <div className="report-toolbar-right">
            <ReportBusinessSelect value={draftFilters.business} onChange={value => update('business', value)} options={businessOptions} />
            <select className="report-control report-select" value={String(draftFilters.mediaId)} onChange={event => update('mediaId', event.target.value)}><option value="">{t('media')}</option>{mediaList.map(m => <option key={m.id} value={String(m.id)}>{displayName(m.name)}</option>)}</select>
            <ReportSearchField placeholder={compactSearchPlaceholder(t('search'))} value={draftFilters.search} onChange={value => { setDraftFilters(prev => ({ ...prev, search: value })); }} />
            <select className="report-control report-select report-select-small" value={draftFilters.type} onChange={event => update('type', event.target.value)}><option value="">{t('type')}</option><option value="CPM">CPM</option><option value="CPS">CPS</option><option value="CPA">CPA</option></select>
            <select className="report-control report-select report-status-select" value={draftFilters.status} onChange={event => update('status', event.target.value)}>
              <option value="">{t('status')}</option>
              <option value="all">{t('allStatuses')}</option>
              <option value="confirmed">{t('confirmed')}</option>
              <option value="pendingConfirm">{t('pendingConfirm')}</option>
            </select>
            <button
              type="button"
              className="btn-primary report-download-btn data-download-btn"
              onClick={handleQuery}
              disabled={!!dateValidation}
              title={t('query')}
            >
              {t('query') || 'Truy vấn'}
            </button>
            <button
              type="button"
              className="btn-primary report-download-btn data-download-btn"
              onClick={() => downloadCsv('媒体数据查询.csv', columns, visibleRows)}
              title={isDirty ? (t('exportDirtyWarning') || 'Filters changed. Click Query first.') : t('dataDownload')}
              disabled={isDirty || !appliedFilters.startDate}
            >
              {t('exportExcel') || 'Xuất Excel'}
            </button>
          </div>
        </div>
        {isDirty && appliedFilters.startDate && (
          <div className="form-note">Bộ lọc đã thay đổi. Vui lòng bấm Truy vấn để cập nhật kết quả.</div>
        )}
        {dateWarning && <div className="form-note">{dateWarning}</div>}
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
                  <td>{displayName(orderNameForMediaRow(row))}</td>
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
              )) : !appliedFilters.startDate ? (
                <tr><td colSpan={13} className="empty-state-text">Chọn khoảng ngày rồi bấm Truy vấn để xem dữ liệu.</td></tr>
              ) : (
                <tr><td colSpan={13} className="empty-state-text">Không có dữ liệu trong khoảng ngày/bộ lọc đã chọn.</td></tr>
              )}
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