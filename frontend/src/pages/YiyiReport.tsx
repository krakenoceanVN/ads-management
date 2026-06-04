import React, { useState, useCallback } from 'react';
import { useAppContext } from '../AppContext';
import { getYiyiMonthlyData, type YiyiMonthlyRow } from '../api/yiyiApi';
import { Download, RefreshCw } from 'lucide-react';

const YIYI_CHANNELS = ['yy-02-01', 'yy-02-02', 'yy-02-03', 'yy-02-04'] as const;

function numeric(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function hasValue(value: unknown): boolean {
  return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function formatMoney(value: unknown): string {
  if (!hasValue(value)) return '0.00';
  return numeric(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInteger(value: unknown): string {
  if (!hasValue(value)) return '0';
  return numeric(value).toLocaleString();
}

function formatUnitPrice(value: unknown): string {
  if (!hasValue(value)) return '0.00';
  return numeric(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface RowValidation {
  hasIssue: boolean;
}

function validateRow(row: YiyiMonthlyRow): RowValidation {
  const traffic = numeric(row['yy-02-01']) + numeric(row['yy-02-02']) + numeric(row['yy-02-03']) + numeric(row['yy-02-04']);
  const vendorPayable = traffic / 1000 * numeric(row.unit_price);
  const profit = traffic / 1000 * numeric(row.profit_unit_price);
  const grandTotal = vendorPayable + profit;
  const expectedVendor = traffic / 1000 * numeric(row.unit_price);
  const expectedProfit = traffic / 1000 * numeric(row.profit_unit_price);
  const expectedGrand = expectedVendor + expectedProfit;
  const hasIssue = Math.abs(vendorPayable - expectedVendor) > 0.01
    || Math.abs(profit - expectedProfit) > 0.01
    || Math.abs(grandTotal - expectedGrand) > 0.01;
  return { hasIssue };
}

export function YiyiReport() {
  const { t } = useAppContext();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(String(currentMonth));
  const [rows, setRows] = useState<YiyiMonthlyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(false);

  const loadData = useCallback(async () => {
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      setError('Năm hoặc tháng không hợp lệ.');
      return;
    }

    setLoading(true);
    setError('');
    setFetched(false);
    try {
      const data = await getYiyiMonthlyData({ year: yearNum, month: monthNum });
      setRows(data);
      setFetched(true);
    } catch (err) {
      setError('Không thể tải báo cáo Yiyi.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  const handleSearch = () => {
    void loadData();
  };

  const handleRefresh = () => {
    void loadData();
  };

  // Calculate totals from fetched rows
  const totals = React.useMemo(() => {
    if (!rows.length) return { totalTraffic: 0, totalVendorPayable: 0, totalProfit: 0, totalGrandTotal: 0 };
    let totalTraffic = 0;
    let totalVendorPayable = 0;
    let totalProfit = 0;
    let totalGrandTotal = 0;
    for (const row of rows) {
      const traffic = numeric(row['yy-02-01']) + numeric(row['yy-02-02']) + numeric(row['yy-02-03']) + numeric(row['yy-02-04']);
      const vp = traffic / 1000 * numeric(row.unit_price);
      const p = traffic / 1000 * numeric(row.profit_unit_price);
      const gt = vp + p;
      totalTraffic += traffic;
      totalVendorPayable += vp;
      totalProfit += p;
      totalGrandTotal += gt;
    }
    return { totalTraffic, totalVendorPayable, totalProfit, totalGrandTotal };
  }, [rows]);

  const invalidRowCount = React.useMemo(() => {
    return rows.filter(row => validateRow(row).hasIssue).length;
  }, [rows]);

  // Generate year options (2020-2030)
  const yearOptions = [];
  for (let y = 2020; y <= 2030; y++) {
    yearOptions.push(y);
  }
  const monthOptions = [];
  for (let m = 1; m <= 12; m++) {
    monthOptions.push(m);
  }

  const handleExport = () => {
    if (!rows.length) return;
    const header = ['Ngày', 'Lượng', 'Đơn giá', 'Số tiền phải trả', 'YY-02-01', 'YY-02-02', 'YY-02-03', 'YY-02-04', 'Đơn giá lợi nhuận', 'Lợi nhuận', 'Tổng cộng'];
    const body = rows.map(row => {
      const traffic = numeric(row['yy-02-01']) + numeric(row['yy-02-02']) + numeric(row['yy-02-03']) + numeric(row['yy-02-04']);
      const vp = traffic / 1000 * numeric(row.unit_price);
      const p = traffic / 1000 * numeric(row.profit_unit_price);
      const gt = vp + p;
      return [
        row.date,
        traffic,
        numeric(row.unit_price).toFixed(2),
        vp.toFixed(2),
        numeric(row['yy-02-01']),
        numeric(row['yy-02-02']),
        numeric(row['yy-02-03']),
        numeric(row['yy-02-04']),
        numeric(row.profit_unit_price).toFixed(2),
        p.toFixed(2),
        gt.toFixed(2),
      ].join(',');
    });
    const totalLine = [
      'Tổng cộng',
      totals.totalTraffic,
      '',
      totals.totalVendorPayable.toFixed(2),
      '',
      '',
      '',
      '',
      '',
      totals.totalProfit.toFixed(2),
      totals.totalGrandTotal.toFixed(2),
    ].join(',');
    const csv = [header.join(','), ...body, totalLine].join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yiyi-report-${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page active">
      {/* Page Header */}
      <div className="yiyi-report-page-header">
        <div className="yiyi-report-header-left">
          <h1 className="yiyi-report-title">{t('pYiyiReport')}</h1>
          <p className="yiyi-report-subtitle">
            {t('yiyiReportSubtitle') || 'Theo dõi dữ liệu Yiyi theo tháng, tổng hợp traffic, số tiền phải trả, lợi nhuận và tổng cộng.'}
          </p>
        </div>
        {fetched && rows.length > 0 && (
          <button type="button" className="btn-primary yiyi-report-export-btn" onClick={handleExport}>
            <Download size={14} strokeWidth={2} />
            {t('exportCSV') || 'Xuất CSV'}
          </button>
        )}
      </div>

      {/* Filter Card */}
      <div className="card yiyi-report-filter-card">
        <div className="yiyi-report-filter-row">
          <div className="yiyi-report-filter-group">
            <label className="yiyi-report-filter-label">{t('year') || 'Năm'}</label>
            <select
              className="yiyi-report-select"
              value={year}
              onChange={e => { setYear(e.target.value); setFetched(false); }}
            >
              {yearOptions.map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
          <div className="yiyi-report-filter-group">
            <label className="yiyi-report-filter-label">{t('month') || 'Tháng'}</label>
            <select
              className="yiyi-report-select"
              value={month}
              onChange={e => { setMonth(e.target.value); setFetched(false); }}
            >
              {monthOptions.map(m => (
                <option key={m} value={String(m)}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn-primary yiyi-report-search-btn"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw size={14} strokeWidth={2} className="yiyi-spin" />
            ) : (
              t('query') || 'Tìm kiếm'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="yiyi-report-error">
          <span>{error}</span>
        </div>
      )}

      {loading && !fetched && (
        <div className="yiyi-report-loading">
          <div className="yiyi-report-loading-inner">
            <RefreshCw size={24} strokeWidth={1.5} className="yiyi-spin-lg" />
            <span>{t('yiyiReportLoading') || 'Đang tải báo cáo Yiyi...'}</span>
          </div>
        </div>
      )}

      {fetched && rows.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="yiyi-report-summary-grid">
            <div className="yiyi-summary-card">
              <div className="yiyi-summary-card-sub">{t('traffic') || 'Tổng lượng'}</div>
              <div className="yiyi-summary-card-label">量级</div>
              <div className="yiyi-summary-card-value">{formatInteger(totals.totalTraffic)}</div>
            </div>
            <div className="yiyi-summary-card">
              <div className="yiyi-summary-card-sub">{t('vendorPayable') || 'Số tiền phải trả'}</div>
              <div className="yiyi-summary-card-label">金额</div>
              <div className="yiyi-summary-card-value">{formatMoney(totals.totalVendorPayable)}</div>
            </div>
            <div className="yiyi-summary-card">
              <div className="yiyi-summary-card-sub">{t('profit')}</div>
              <div className="yiyi-summary-card-label">利润</div>
              <div className="yiyi-summary-card-value">{formatMoney(totals.totalProfit)}</div>
            </div>
            <div className="yiyi-summary-card yiyi-summary-card-total">
              <div className="yiyi-summary-card-sub">{t('grandTotal') || 'Tổng cộng'}</div>
              <div className="yiyi-summary-card-label">总计</div>
              <div className="yiyi-summary-card-value">{formatMoney(totals.totalGrandTotal)}</div>
            </div>
          </div>

          {/* Validation Status Bar */}
          <div className="yiyi-report-status-bar">
            <span>{rows.length} {t('days') || 'ngày'}</span>
            <span className="yiyi-report-status-sep">·</span>
            <span className={invalidRowCount > 0 ? 'yiyi-report-status-warn' : 'yiyi-report-status-ok'}>
              {invalidRowCount} {t('invalidRows') || 'dòng lỗi'}
            </span>
            <span className="yiyi-report-status-sep">·</span>
            <span className={invalidRowCount === 0 ? 'yiyi-report-status-ok' : 'yiyi-report-status-warn'}>
              {invalidRowCount === 0
                ? (t('dataValid') || 'Dữ liệu hợp lệ')
                : (t('dataHasErrors') || 'Dữ liệu có lỗi')}
            </span>
          </div>

          {/* Table */}
          <div className="card yiyi-report-table-card">
            <div className="table-wrap yiyi-report-table-wrap">
              <table className="yiyi-report-table">
                <thead>
                  <tr>
                    <th className="yiyi-th-center">{t('date') || 'Ngày'}</th>
                    <th className="yiyi-th-right">{t('traffic') || 'Lượng'}<div className="yiyi-th-sub">量级</div></th>
                    <th className="yiyi-th-right">{t('unitPrice') || 'Đơn giá'}</th>
                    <th className="yiyi-th-right">{t('vendorPayable') || 'Số tiền'}<div className="yiyi-th-sub">金额</div></th>
                    <th className="yiyi-th-right">YY-02-01</th>
                    <th className="yiyi-th-right">YY-02-02</th>
                    <th className="yiyi-th-right">YY-02-03</th>
                    <th className="yiyi-th-right">YY-02-04</th>
                    <th className="yiyi-th-right">{t('profitUnitPrice') || 'Đơn giá LP'}<div className="yiyi-th-sub">利润单价</div></th>
                    <th className="yiyi-th-right">{t('profit')}<div className="yiyi-th-sub">利润</div></th>
                    <th className="yiyi-th-right">{t('grandTotal') || 'Tổng'}<div className="yiyi-th-sub">总计</div></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const traffic = numeric(row['yy-02-01']) + numeric(row['yy-02-02']) + numeric(row['yy-02-03']) + numeric(row['yy-02-04']);
                    const vendorPayable = traffic / 1000 * numeric(row.unit_price);
                    const profit = traffic / 1000 * numeric(row.profit_unit_price);
                    const grandTotal = vendorPayable + profit;
                    const validation = validateRow(row);
                    return (
                      <tr key={row.date} className={`${idx % 2 === 1 ? 'yiyi-row-alt' : ''} ${validation.hasIssue ? 'yiyi-row-error' : ''}`}>
                        <td className="yiyi-td-center yiyi-td-date">{row.date}</td>
                        <td className="yiyi-td-right yiyi-td-traffic">{formatInteger(traffic)}</td>
                        <td className="yiyi-td-right">{formatUnitPrice(row.unit_price)}</td>
                        <td className="yiyi-td-right yiyi-td-money">{formatMoney(vendorPayable)}</td>
                        <td className="yiyi-td-right">{formatInteger(row['yy-02-01'])}</td>
                        <td className="yiyi-td-right">{formatInteger(row['yy-02-02'])}</td>
                        <td className="yiyi-td-right">{formatInteger(row['yy-02-03'])}</td>
                        <td className="yiyi-td-right">{formatInteger(row['yy-02-04'])}</td>
                        <td className="yiyi-td-right">{formatUnitPrice(row.profit_unit_price)}</td>
                        <td className="yiyi-td-right yiyi-td-money">{formatMoney(profit)}</td>
                        <td className="yiyi-td-right yiyi-td-money yiyi-td-grand">{formatMoney(grandTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="yiyi-tfoot-row">
                    <td className="yiyi-td-center">{t('total') || 'Tổng cộng'}</td>
                    <td className="yiyi-td-right yiyi-td-traffic">{formatInteger(totals.totalTraffic)}</td>
                    <td className="yiyi-td-right"></td>
                    <td className="yiyi-td-right yiyi-td-money">{formatMoney(totals.totalVendorPayable)}</td>
                    <td className="yiyi-td-right"></td>
                    <td className="yiyi-td-right"></td>
                    <td className="yiyi-td-right"></td>
                    <td className="yiyi-td-right"></td>
                    <td className="yiyi-td-right"></td>
                    <td className="yiyi-td-right yiyi-td-money">{formatMoney(totals.totalProfit)}</td>
                    <td className="yiyi-td-right yiyi-td-money yiyi-td-grand">{formatMoney(totals.totalGrandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {fetched && rows.length === 0 && (
        <div className="yiyi-report-empty">
          <div className="yiyi-report-empty-icon">📊</div>
          <div className="yiyi-report-empty-text">{t('yiyiReportNoData') || 'Không có dữ liệu cho tháng đã chọn.'}</div>
        </div>
      )}

      {!fetched && !loading && !error && (
        <div className="yiyi-report-empty">
          <div className="yiyi-report-empty-icon">📅</div>
          <div className="yiyi-report-empty-text">{t('yiyiReportSelectMonth') || 'Chọn năm và tháng, nhấn Tìm kiếm để xem báo cáo.'}</div>
        </div>
      )}
    </div>
  );
}
