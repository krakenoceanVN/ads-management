import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button, DatePicker, Spin, Table } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import html2pdf from 'html2pdf.js'
import api, { isAdmin } from '../../api/axios'
import DashboardBottomScrollbar from '../dashboard/DashboardBottomScrollbar'
import { withTableEllipsis } from '../../utils/tableEllipsis'
import { formatIsoMoney, formatIsoPercent, toFiniteNumber } from '../../utils/numberFormat'

interface DailyRow {
  date: string
  smRevenue: number
  leRevenue: number
  taxRate: number
  tax: number
  vendorCost: number
  mlCost: number
  totalCost: number
  cost?: number
  profit: number
  profitRate: number
  upstreamBreakdown: Record<string, number>
  isTotal?: boolean
}

interface ApiResponse {
  success: boolean
  data: {
    upstreamNames: string[]
    rows: DailyRow[]
  }
}

interface Props {
  month: Dayjs
  onMonthChange: (m: Dayjs) => void
}

function isSummaryRow(row: DailyRow): boolean {
  return row.isTotal === true || row.date === 'TOTAL'
}

function toNumber(value: unknown): number {
  return toFiniteNumber(value)
}

function formatMoney(value: unknown): string {
  return formatIsoMoney(value)
}

function formatPercent(value: unknown): string {
  const percentage = toNumber(value) * 100
  return formatIsoPercent(value, {
    minimumFractionDigits: Number.isInteger(percentage) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(percentage) ? 0 : 2,
  })
}

function getUpstreamTotal(row: Pick<DailyRow, 'upstreamBreakdown'>): number {
  return Object.values(row.upstreamBreakdown ?? {}).reduce((sum, value) => sum + Number(value ?? 0), 0)
}

function buildDisplayRow(row: DailyRow): DailyRow {
  return {
    ...row,
    smRevenue: toNumber(row.smRevenue),
    leRevenue: toNumber(row.leRevenue),
    taxRate: toNumber(row.taxRate),
    tax: toNumber(row.tax),
    vendorCost: toNumber(row.vendorCost),
    mlCost: toNumber(row.mlCost),
    totalCost: toNumber(row.totalCost ?? row.cost),
    profit: toNumber(row.profit),
    profitRate: toNumber(row.profitRate),
    upstreamBreakdown: row.upstreamBreakdown ?? {},
  }
}

function buildSummaryRow(rows: DailyRow[]): DailyRow {
  const upstreamBreakdown: Record<string, number> = {}

  for (const row of rows) {
    for (const [name, value] of Object.entries(row.upstreamBreakdown ?? {})) {
      upstreamBreakdown[name] = (upstreamBreakdown[name] ?? 0) + Number(value ?? 0)
    }
  }

  const smRevenue = rows.reduce((sum, row) => sum + row.smRevenue, 0)
  const leRevenue = rows.reduce((sum, row) => sum + row.leRevenue, 0)
  const tax = rows.reduce((sum, row) => sum + row.tax, 0)
  const vendorCost = rows.reduce((sum, row) => sum + row.vendorCost, 0)
  const mlCost = rows.reduce((sum, row) => sum + row.mlCost, 0)
  const totalCost = rows.reduce((sum, row) => sum + row.totalCost, 0)
  const profit = rows.reduce((sum, row) => sum + row.profit, 0)

  return {
    date: 'TOTAL',
    smRevenue,
    leRevenue,
    taxRate: rows[0]?.taxRate ?? 0,
    tax,
    vendorCost,
    mlCost,
    totalCost,
    profit,
    profitRate: leRevenue > 0 ? profit / leRevenue : 0,
    upstreamBreakdown,
    isTotal: true,
  }
}

export default function LESummaryTable({ month, onMonthChange }: Props) {
  const { t, i18n } = useTranslation()
  const tableHostRef = useRef<HTMLDivElement | null>(null)
  const monthKey = month.format('YYYY-MM')
  const queryKey = ['le-dashboard', monthKey] as const
  const isOfficialView = isAdmin()
  const language = (i18n.resolvedLanguage ?? i18n.language ?? 'vi').split('-')[0]
  const intlLocale = language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'vi-VN'

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get<ApiResponse>('/api/dashboard/le', {
        params: { month: monthKey },
      })
      return res.data.data
    },
  })

  const adSiteNames = data?.upstreamNames ?? []
  const sourceRows = (data?.rows ?? []).filter((row) => !isSummaryRow(row))
  const displayDailyRows = sourceRows.map((row) => buildDisplayRow(row))
  const summaryRow = buildSummaryRow(displayDailyRows)
  const displayRows = [summaryRow, ...displayDailyRows]

  const exportPDF = () => {
    if (displayRows.length === 0) return
    const dateColWidth = 96
    const standardColWidth = 112
    const taxRateColWidth = 84
    const upstreamColWidth = 108
    const pageMargin = 6
    const tableWidthPx = dateColWidth
      + (standardColWidth * 5)
      + taxRateColWidth
      + ((adSiteNames.length + 1) * upstreamColWidth)
    const pageWidthPx = tableWidthPx + (pageMargin * 2) + 24
    const pageHeightPx = Math.max(1200, 220 + ((displayRows.length + 3) * 28))
    const reportNote = isOfficialView ? t('downstream.officialReportNote') : t('downstream.draftReportNote')

    const renderMoneyCell = (value: number, color = '#1f2937') => `
      <td style="border: 1px solid #ccc; padding: 5px 4px; text-align: right; color: ${color};${color !== '#1f2937' ? ' font-weight: 600;' : ''}">
        ${formatMoney(value)}
      </td>
    `

    const renderRow = (record: DailyRow, index: number) => {
      const isTotal = record.isTotal
      const bgColor = isTotal ? '#fff5d6' : index % 2 === 0 ? '#ffffff' : '#f5f5f5'

      return `
        <tr style="background: ${bgColor};${isTotal ? ' font-weight: 700;' : ''}">
          <td style="border: 1px solid #ccc; padding: 5px 4px; text-align: center; font-weight: 600; color: #1f2937;">${isTotal ? t('downstream.summary') : record.date}</td>
          ${renderMoneyCell(record.smRevenue)}
          ${renderMoneyCell(record.leRevenue, '#2563eb')}
          <td style="border: 1px solid #ccc; padding: 5px 4px; text-align: center; color: #1f2937;">${formatPercent(record.taxRate)}</td>
          ${renderMoneyCell(record.tax)}
          ${renderMoneyCell(record.totalCost, '#b45309')}
          ${renderMoneyCell(record.profit, record.profit >= 0 ? '#15803d' : '#dc2626')}
          ${adSiteNames.map((name) => renderMoneyCell(toNumber(record.upstreamBreakdown?.[name]))).join('')}
          ${renderMoneyCell(getUpstreamTotal(record))}
        </tr>
      `
    }

    const exporter = html2pdf() as any
    const pdfHTML = `
      <div style="font-family: 'Segoe UI', 'Microsoft YaHei', 'Microsoft JhengHei', Arial, sans-serif; color: #1f2937; padding: 12px; background: #fff; width: ${tableWidthPx}px; box-sizing: border-box;">
        <style>
          .le-report-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 9px;
            color: #1f2937;
          }
          .le-report-table thead {
            display: table-header-group;
          }
          .le-report-table th,
          .le-report-table td {
            vertical-align: middle;
            white-space: nowrap;
            color: #1f2937;
          }
          .le-report-table th.col-date,
          .le-report-table td.col-date {
            width: ${dateColWidth}px;
          }
          .le-report-table th.col-standard,
          .le-report-table td.col-standard {
            width: ${standardColWidth}px;
          }
          .le-report-table th.col-tax-rate,
          .le-report-table td.col-tax-rate {
            width: ${taxRateColWidth}px;
          }
          .le-report-table th.col-upstream,
          .le-report-table td.col-upstream {
            width: ${upstreamColWidth}px;
          }
        </style>
        <h2 style="text-align: center; margin: 0 0 4px 0; font-size: 16px; color: #222;">
          ${t('downstream.lePdfTitle', { month: monthKey })}
        </h2>
        <p style="text-align: center; margin: 0 0 10px 0; color: #666; font-size: 11px;">
          ${t('downstream.lePdfNote')}
        </p>
        <p style="text-align: center; margin: 0 0 10px 0; color: ${isOfficialView ? '#0f766e' : '#b45309'}; font-size: 11px; font-weight: 600;">
          ${reportNote}
        </p>
        <table class="le-report-table">
          <thead>
            <tr style="background: #d9d9d9;">
              <th class="col-date" style="border: 1px solid #999; padding: 6px 4px; text-align: center; font-weight: bold; color: #333;">${t('downstream.date')}</th>
              <th class="col-standard" style="border: 1px solid #999; padding: 6px 4px; text-align: center; font-weight: bold; color: #333;">${t('downstream.revenue')}</th>
              <th class="col-standard" style="border: 1px solid #999; padding: 6px 4px; text-align: center; font-weight: bold; color: #333;">${t('downstream.ninetyPercent')}</th>
              <th class="col-tax-rate" style="border: 1px solid #999; padding: 6px 4px; text-align: center; font-weight: bold; color: #333;">${t('downstream.taxRate')}</th>
              <th class="col-standard" style="border: 1px solid #999; padding: 6px 4px; text-align: center; font-weight: bold; color: #333;">${t('downstream.taxAmount')}</th>
              <th class="col-standard" style="border: 1px solid #999; padding: 6px 4px; text-align: center; font-weight: bold; color: #333;">${t('downstream.expense')}</th>
              <th class="col-standard" style="border: 1px solid #999; padding: 6px 4px; text-align: center; font-weight: bold; color: #333;">${t('downstream.profit')}</th>
              ${adSiteNames.map((name) => `
                <th class="col-upstream" style="border: 1px solid #999; padding: 6px 4px; text-align: center; font-weight: bold; color: #333;">${name}</th>
              `).join('')}
              <th class="col-upstream" style="border: 1px solid #999; padding: 6px 4px; text-align: center; font-weight: bold; color: #333;">${t('downstream.total')}</th>
            </tr>
          </thead>
          <tbody>
            ${displayRows.map((record, index) => renderRow(record, index)).join('')}
          </tbody>
        </table>
        <p style="margin-top: 10px; font-size: 10px; color: #aaa; text-align: right;">
          ${t('downstream.reportFooter', {
            date: new Intl.DateTimeFormat(intlLocale).format(new Date()),
          })}
        </p>
      </div>
    `

    void exporter.set({
      margin: pageMargin,
      filename: `LE-summary-${monthKey}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        width: tableWidthPx,
        windowWidth: pageWidthPx,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff',
      },
      jsPDF: {
        unit: 'px' as const,
        format: [pageWidthPx, pageHeightPx] as [number, number],
        orientation: 'portrait' as const,
        hotfixes: ['px_scaling'],
      },
    }).from(pdfHTML, 'string').save()
  }

  const columns: ColumnsType<DailyRow> = withTableEllipsis([
    {
      title: t('downstream.date'),
      dataIndex: 'date',
      key: 'date',
      width: 96,
      fixed: 'left',
      render: (_value: string, record) => (
        <span style={{ fontWeight: 600 }}>
          {record.isTotal ? t('downstream.summary') : record.date}
        </span>
      ),
    },
    {
      title: t('downstream.revenue'),
      dataIndex: 'smRevenue',
      key: 'smRevenue',
      width: 112,
      render: (value: number) => formatMoney(value),
    },
    {
      title: t('downstream.ninetyPercent'),
      dataIndex: 'leRevenue',
      key: 'leRevenue',
      width: 112,
      render: (value: number) => <span style={{ color: '#2563eb', fontWeight: 600 }}>{formatMoney(value)}</span>,
    },
    {
      title: t('downstream.taxRate'),
      dataIndex: 'taxRate',
      key: 'taxRate',
      width: 84,
      render: (value: number) => formatPercent(value),
    },
    {
      title: t('downstream.taxAmount'),
      dataIndex: 'tax',
      key: 'tax',
      width: 112,
      render: (value: number) => formatMoney(value),
    },
    {
      title: t('downstream.expense'),
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 112,
      render: (value: number) => <span style={{ color: '#b45309', fontWeight: 600 }}>{formatMoney(value)}</span>,
    },
    {
      title: t('downstream.profit'),
      dataIndex: 'profit',
      key: 'profit',
      width: 112,
      render: (value: number) => (
        <span style={{ color: value >= 0 ? '#15803d' : '#dc2626', fontWeight: 600 }}>
          {formatMoney(value)}
        </span>
      ),
    },
    ...adSiteNames.map((name) => ({
      title: name,
      key: `site-${name}`,
      width: 108,
      render: (_value: unknown, record: DailyRow) => formatMoney(record.upstreamBreakdown?.[name] ?? 0),
    })),
    {
      title: t('downstream.total'),
      key: 'site-total',
      width: 108,
      render: (_value: unknown, record: DailyRow) => formatMoney(getUpstreamTotal(record)),
    },
  ])
  const tableWatchKey = [
    monthKey,
    adSiteNames.join('|'),
    displayRows.length,
  ].join(':')

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="le-summary-table" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`
        .le-summary-table .ant-table-cell {
          font-variant-numeric: tabular-nums;
        }
        .le-summary-table .ant-table-thead > tr > th {
          text-align: center;
          white-space: nowrap;
        }
        .le-summary-table .ant-table-tbody > tr.le-summary-row > td {
          background: #fff5d6 !important;
          font-weight: 700;
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <DatePicker
          picker="month"
          value={month}
          format="YYYY-MM"
          onChange={(value) => {
            if (value) onMonthChange(value)
          }}
          allowClear={false}
        />
        <Button type="primary" icon={<DownloadOutlined />} onClick={exportPDF}>
          {t('downstream.exportPdfLe')}
        </Button>
        <span style={{ color: '#6b7280', fontSize: 12 }}>
          {t('downstream.leReadOnlyNote')}
        </span>
        <span style={{ color: isOfficialView ? '#0f766e' : '#b45309', fontSize: 12 }}>
          {isOfficialView ? t('downstream.officialReportNote') : t('downstream.draftReportNote')}
        </span>
      </div>
      <div ref={tableHostRef} className="dashboard-table-shell">
        <Table
          className="app-data-table dashboard-total-table dashboard-total-table--with-bottom-scroll"
          columns={columns}
          dataSource={displayRows}
          rowKey={(record) => (record.isTotal ? 'le-summary' : record.date)}
          size="small"
          bordered
          pagination={false}
          sticky={{ offsetHeader: 64, offsetScroll: 17 }}
          scroll={{ x: 900 + ((adSiteNames.length + 1) * 108) }}
          rowClassName={(record) => (record.isTotal ? 'le-summary-row' : '')}
          tableLayout="fixed"
        />
        <DashboardBottomScrollbar tableHostRef={tableHostRef} watchKey={tableWatchKey} leadingOffsetPx={96} />
      </div>
    </div>
  )
}
