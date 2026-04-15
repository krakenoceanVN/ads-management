import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Table, DatePicker, InputNumber, Button } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useParams, Link } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import html2pdf from 'html2pdf.js'
import api, { isAdmin } from '../api/axios'
import type { ApiResponse } from '../types'
import DashboardBottomScrollbar from '../components/dashboard/DashboardBottomScrollbar'
import LESummaryTable from '../components/downstream/LESummaryTable'
import { withTableEllipsis } from '../utils/tableEllipsis'
import { formatIsoFixed, formatIsoInteger, formatIsoMoney, formatIsoNumber } from '../utils/numberFormat'

interface DownstreamRow {
  id: number
  ad_type_id: number
  ad_type_code: string
  downstream_type: string
  payout_rate: number
  status: 'active' | 'inactive'
}

interface DownstreamPeriodRow {
  id: number
  downstream_id: number
  pct_hal: number
  unit_price?: number | null
  start_date: string
  end_date?: string | null
}

interface DownstreamRateRow {
  id: number
  downstream_id: number
  date: string
  effective_rate: number
}

interface DownstreamInputValue {
  date: string
  qty: number | null
  amount1: number | null
  amount2: number | null
  revenue: number
  status: string
}

interface DownstreamInputRow {
  id: number
  ad_site_name: string
  upstream_name: string
  billing_method: string
  custom_price: number | null
  resolved_price?: number | null
  input: DownstreamInputValue | null
  inputs?: DownstreamInputValue[] | Record<string, DownstreamInputValue>
  inputs_by_date?: Record<string, DownstreamInputValue>
}

type PivotRow = {
  date: string
  total_uv: number
  total_ml: number
  [adSiteId: string]: number | string
}

const EMPTY_DOWNSTREAM_ROWS: DownstreamRow[] = []
const EMPTY_INPUT_ROWS: DownstreamInputRow[] = []
const EMPTY_PERIOD_ROWS: DownstreamPeriodRow[] = []
const EMPTY_RATE_ROWS: DownstreamRateRow[] = []

function formatDisplayValue(value: number | string, formatter: (n: number) => string): string {
  if (value === '' || value === null || value === undefined) return '-'
  if (typeof value !== 'number') return String(value)
  return formatter(value)
}

function getRowInputs(row: DownstreamInputRow): DownstreamInputValue[] {
  if (Array.isArray(row.inputs)) return row.inputs
  if (row.inputs && typeof row.inputs === 'object') return Object.values(row.inputs)
  if (row.inputs_by_date) return Object.values(row.inputs_by_date)
  return row.input ? [row.input] : []
}

function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = []
  const date = new Date(year, month - 1, 1)
  while (date.getMonth() === month - 1) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    days.push(`${y}-${m}-${d}`)
    date.setDate(date.getDate() + 1)
  }
  return days
}

// Get effective rate for a day (inherit from previous days if not set explicitly)
function getEffectiveRate(
  dayIndex: number,
  allDays: string[],
  explicitRates: Record<string, number>,
  getDefaultRate: (date: string) => number
): number {
  const today = allDays[dayIndex]
  if (explicitRates[today] !== undefined) {
    return explicitRates[today]
  }
  for (let i = dayIndex - 1; i >= 0; i--) {
    const prevDay = allDays[i]
    if (explicitRates[prevDay] !== undefined) {
      return explicitRates[prevDay]
    }
  }
  return getDefaultRate(today)
}

export default function DownstreamSitesPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const tableHostRef = useRef<HTMLDivElement | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format('YYYY-MM'))
  const [leMonth, setLeMonth] = useState(dayjs())
  const [explicitRates, setExplicitRates] = useState<Record<string, number>>({})
  const isOfficialView = isAdmin()
  const canEditRates = isOfficialView
  const language = (i18n.resolvedLanguage ?? i18n.language ?? 'vi').split('-')[0]
  const intlLocale = language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'vi-VN'

  const { data: downstreamsData } = useQuery({
    queryKey: ['admin', 'downstreams'],
    queryFn: () => api.get<ApiResponse<DownstreamRow[]>>('/api/admin/downstreams').then((r) => r.data.data ?? []),
  })
  const downstreams = downstreamsData ?? EMPTY_DOWNSTREAM_ROWS

  const downstream = downstreams.find((d) => d.id === Number(id))
  const isLE = downstream?.downstream_type === 'LE'
  const is360 = downstream?.ad_type_code === '360'
  const isMl360 = downstream?.downstream_type === 'ML' && downstream?.ad_type_code === '360'
  const basePayoutRate = (isMl360 ? 0.8 : Number(downstream?.payout_rate ?? 0.8)) * 100
  const basePayoutLabel = Number.isInteger(basePayoutRate)
    ? formatIsoNumber(basePayoutRate, { maximumFractionDigits: 0 })
    : formatIsoFixed(basePayoutRate, 2)

  const { data: siteInputsData, isLoading } = useQuery({
    queryKey: ['admin', 'downstream-sites', id, 'inputs', selectedMonth],
    queryFn: () =>
      api
        .get<ApiResponse<DownstreamInputRow[]>>(`/api/admin/downstream-sites/${id}/inputs`, {
          params: { month: selectedMonth },
        })
        .then((r) => r.data.data ?? []),
    enabled: !!id && !!downstream,
  })
  const siteInputs = siteInputsData ?? EMPTY_INPUT_ROWS

  const { data: downstreamPeriodsData } = useQuery({
    queryKey: ['admin', 'downstream-periods'],
    queryFn: () =>
      api
        .get<ApiResponse<DownstreamPeriodRow[]>>('/api/admin/downstream-periods')
        .then((r) => r.data.data ?? []),
    enabled: !!downstream && !isLE,
  })
  const downstreamPeriods = downstreamPeriodsData ?? EMPTY_PERIOD_ROWS

  const { data: savedRatesData } = useQuery({
    queryKey: ['admin', 'downstream-rates', id, selectedMonth],
    queryFn: () => {
      const startDate = `${selectedMonth}-01`
      const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD')

      return api
        .get<ApiResponse<DownstreamRateRow[]>>('/api/admin/downstream-rates', {
          params: {
            downstream_id: Number(id),
            start_date: startDate,
            end_date: endDate,
          },
        })
        .then((r) => r.data.data ?? [])
    },
    enabled: !!downstream && !isLE,
  })
  const savedRates = savedRatesData ?? EMPTY_RATE_ROWS

  useEffect(() => {
    setExplicitRates({})
  }, [id, selectedMonth])

  useEffect(() => {
    const nextRates = savedRates.reduce<Record<string, number>>((acc, item) => {
      acc[item.date] = item.effective_rate
      return acc
    }, {})
    setExplicitRates(nextRates)
  }, [savedRatesData])

  const [year, month] = selectedMonth.split('-').map(Number)
  const relevantPeriods = downstreamPeriods
    .filter((period) => period.downstream_id === Number(id))
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
  const getDefaultRateForDate = (date: string): number => {
    const period = relevantPeriods.find((item) => item.start_date <= date && (!item.end_date || item.end_date >= date))
    return period ? Number(period.pct_hal ?? 1) * 100 : 100
  }

  // PDF export function - styled ML report
  const exportPDF = () => {
    if (pivotRows.length === 0) return
    const pageMargin = 6
    const dateColWidth = 96
    const totalUvColWidth = 110
    const totalMlColWidth = 120
    const payoutColWidth = 120
    const adjustedColWidth = 170
    const siteColWidth = 96
    const siteMetricColWidth = 96
    const tableWidthPx = dateColWidth
      + totalUvColWidth
      + totalMlColWidth
      + payoutColWidth
      + adjustedColWidth
      + (adSiteIds.length * (is360 ? siteMetricColWidth * 3 : siteColWidth))
    const pageWidthPx = tableWidthPx + (pageMargin * 2) + 24
    const pageHeightPx = Math.max(1200, 220 + ((pivotRows.length + 2) * 28))
    const opt = {
      margin: pageMargin,
      filename: `Bao-cao-${downstream?.downstream_type}-${downstream?.ad_type_code}-${selectedMonth}.pdf`,
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
    }

    const totalQty = pivotRows.reduce((s: number, r: PivotRow) => s + (r.total_uv || 0), 0)
    const totalML = pivotRows.reduce((s: number, r: PivotRow) => s + (r.total_ml || 0), 0)
    const totalBasePayout = totalML * (basePayoutRate / 100)
    const totalAdjustedPayout = pivotRows.reduce((sum: number, row: PivotRow, index: number) => {
      const effectiveRate = getEffectiveRate(index, allDays, explicitRates, getDefaultRateForDate)
      return sum + (row.total_ml * (effectiveRate / 100))
    }, 0)
    const weightedAdjustedRate = totalML > 0 ? (totalAdjustedPayout / totalML) * 100 : getDefaultRateForDate(allDays[0] ?? `${year}-${String(month).padStart(2, '0')}-01`)
    const reportNote = isOfficialView ? t('downstream.officialReportNote') : t('downstream.draftReportNote')

    const renderTable = (siteIds: number[]) => `
      <table class="ml-report-table">
        <thead>
          <tr style="background: #d9d9d9;">
            <th class="col-date" style="border: 1px solid #999; padding: 6px 4px; text-align: center; font-weight: bold; color: #333;">${t('downstream.date')}</th>
            <th class="col-total" style="border: 1px solid #999; padding: 6px 4px; text-align: right; font-weight: bold; color: #333;">${t('downstream.totalUv')}</th>
            <th class="col-total" style="border: 1px solid #999; padding: 6px 4px; text-align: right; font-weight: bold; color: #333;">${t('downstream.totalValue', { type: downstream?.downstream_type || '' })}</th>
            <th class="col-payout" style="border: 1px solid #999; padding: 6px 4px; text-align: right; font-weight: bold; color: #333;">${downstream?.downstream_type || ''}${basePayoutLabel}%</th>
            <th class="col-adjusted" style="border: 1px solid #999; padding: 6px 4px; text-align: center; font-weight: bold; color: #333;">${t('downstream.adjustedRate')}</th>
            ${is360
              ? siteIds.map((siteId) => `
                  <th class="col-site-group" colspan="3" style="border: 1px solid #999; padding: 6px 4px; text-align: center; font-weight: bold; color: #333;">${adSiteNames.get(siteId) ?? String(siteId)}</th>
                `).join('')
              : siteIds.map((siteId) => `
                  <th class="col-site" style="border: 1px solid #999; padding: 6px 4px; text-align: right; font-weight: bold; color: #333;">${adSiteNames.get(siteId) ?? String(siteId)}</th>
                `).join('')}
          </tr>
          ${is360 ? `
            <tr style="background: #ececec;">
              <th class="col-date" style="border: 1px solid #999; padding: 4px; text-align: center;"></th>
              <th class="col-total" style="border: 1px solid #999; padding: 4px; text-align: center;"></th>
              <th class="col-total" style="border: 1px solid #999; padding: 4px; text-align: center;"></th>
              <th class="col-payout" style="border: 1px solid #999; padding: 4px; text-align: center;"></th>
              <th class="col-adjusted" style="border: 1px solid #999; padding: 4px; text-align: center;"></th>
              ${siteIds.map(() => `
                <th class="col-site" style="border: 1px solid #999; padding: 4px; text-align: right; font-weight: bold; color: #333;">${t('downstream.pv')}</th>
                <th class="col-site" style="border: 1px solid #999; padding: 4px; text-align: right; font-weight: bold; color: #333;">${t('downstream.unitPrice')}</th>
                <th class="col-site" style="border: 1px solid #999; padding: 4px; text-align: right; font-weight: bold; color: #333;">${t('downstream.amount')}</th>
              `).join('')}
            </tr>
          ` : ''}
        </thead>
        <tbody>
          ${pivotRows.map((r: PivotRow, idx: number) => {
            const effectiveRate = getEffectiveRate(idx, allDays, explicitRates, getDefaultRateForDate)
            const basePayout = r.total_ml * (basePayoutRate / 100)
            const adjustedPayout = r.total_ml * (effectiveRate / 100)
            const adjustedDisplay = r.total_ml > 0
              ? `${formatIsoNumber(effectiveRate, { maximumFractionDigits: 0 })}% | ${formatIsoMoney(adjustedPayout)}`
              : ''

            return `
            <tr style="background: ${idx % 2 === 0 ? '#fff' : '#f5f5f5'};">
              <td class="col-date" style="border: 1px solid #ccc; padding: 5px 4px; text-align: center; font-weight: 600;">${r.date}</td>
              <td class="col-total" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right;">${r.total_uv > 0 ? formatIsoInteger(r.total_uv) : ''}</td>
              <td class="col-total" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right; color: #2563eb; font-weight: 600;">${r.total_ml > 0 ? formatIsoMoney(r.total_ml) : ''}</td>
              <td class="col-payout" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right; color: #15803d; font-weight: 600;">${r.total_ml > 0 ? formatIsoMoney(basePayout) : ''}</td>
              <td class="col-adjusted" style="border: 1px solid #ccc; padding: 5px 4px; text-align: center; color: #7c3aed; font-weight: 600;">${adjustedDisplay}</td>
              ${is360
                ? siteIds.map((siteId) => {
                    const pv = r[`${siteId}_pv`]
                    const unitPrice = r[`${siteId}_unit_price`]
                    const amount = r[`${siteId}_amount`]
                    return `
                      <td class="col-site" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right; color: #555;">${pv === '' || pv === null || pv === undefined ? '' : formatIsoInteger(Number(pv))}</td>
                      <td class="col-site" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right; color: #555;">${unitPrice === '' || unitPrice === null || unitPrice === undefined ? '' : formatIsoMoney(Number(unitPrice))}</td>
                      <td class="col-site" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right; color: #555;">${amount === '' || amount === null || amount === undefined ? '' : formatIsoMoney(Number(amount))}</td>
                    `
                  }).join('')
                : siteIds.map((siteId) => {
                    const value = r[String(siteId)]
                    return `<td class="col-site" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right; color: #555;">${value === '' || value === null || value === undefined ? '' : formatIsoInteger(Number(value))}</td>`
                  }).join('')}
            </tr>
          `
          }).join('')}
          <tr style="background: #e8f4e8; font-weight: bold;">
            <td class="col-date" style="border: 1px solid #999; padding: 7px 4px; text-align: center;">${t('downstream.grandTotal')}</td>
            <td class="col-total" style="border: 1px solid #999; padding: 7px 4px; text-align: right;">${formatIsoInteger(totalQty)}</td>
            <td class="col-total" style="border: 1px solid #999; padding: 7px 4px; text-align: right; color: #2563eb;">${formatIsoMoney(totalML)}</td>
            <td class="col-payout" style="border: 1px solid #999; padding: 7px 4px; text-align: right; color: #15803d;">${formatIsoMoney(totalBasePayout)}</td>
            <td class="col-adjusted" style="border: 1px solid #999; padding: 7px 4px; text-align: center; color: #7c3aed;">${totalML > 0 ? `${formatIsoFixed(weightedAdjustedRate, 2)}% | ${formatIsoMoney(totalAdjustedPayout)}` : ''}</td>
            ${is360
              ? siteIds.map((siteId) => {
                  const totalPv = pivotRows.reduce((s: number, r: PivotRow) => s + (typeof r[`${siteId}_pv`] === 'number' ? Number(r[`${siteId}_pv`]) : 0), 0)
                  const totalAmount = pivotRows.reduce((s: number, r: PivotRow) => s + (typeof r[`${siteId}_amount`] === 'number' ? Number(r[`${siteId}_amount`]) : 0), 0)
                  const totalUnitPrice = totalPv > 0 ? (totalAmount / totalPv) * 1000 : 0
                  return `
                    <td class="col-site" style="border: 1px solid #999; padding: 7px 4px; text-align: right;">${totalPv > 0 ? formatIsoInteger(totalPv) : ''}</td>
                    <td class="col-site" style="border: 1px solid #999; padding: 7px 4px; text-align: right;">${totalUnitPrice > 0 ? formatIsoMoney(totalUnitPrice) : ''}</td>
                    <td class="col-site" style="border: 1px solid #999; padding: 7px 4px; text-align: right;">${totalAmount > 0 ? formatIsoMoney(totalAmount) : ''}</td>
                  `
                }).join('')
              : siteIds.map((siteId) => {
                  const colTotal = pivotRows.reduce((s: number, r: PivotRow) => {
                    const v = r[String(siteId)]
                    return s + (typeof v === 'number' ? v : 0)
                  }, 0)
                  return `<td class="col-site" style="border: 1px solid #999; padding: 7px 4px; text-align: right;">${colTotal > 0 ? formatIsoInteger(colTotal) : ''}</td>`
                }).join('')}
          </tr>
        </tbody>
      </table>
    `

    const pdfHTML = `
      <div style="font-family: 'Arial', sans-serif; padding: 12px; background: #fff; width: ${tableWidthPx}px; box-sizing: border-box;">
        <style>
          .ml-report-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 9px;
          }
          .ml-report-table thead {
            display: table-header-group;
          }
          .ml-report-table th,
          .ml-report-table td {
            vertical-align: middle;
            white-space: nowrap;
          }
          .ml-report-table th.col-site-group {
            white-space: normal;
            word-break: break-word;
            line-height: 1.2;
          }
          .ml-report-table th.col-date,
          .ml-report-table td.col-date {
            width: 96px;
          }
          .ml-report-table th.col-total,
          .ml-report-table td.col-total {
            width: ${totalUvColWidth}px;
          }
          .ml-report-table th.col-payout,
          .ml-report-table td.col-payout {
            width: ${payoutColWidth}px;
          }
          .ml-report-table th.col-adjusted,
          .ml-report-table td.col-adjusted {
            width: ${adjustedColWidth}px;
          }
          .ml-report-table th.col-site,
          .ml-report-table td.col-site {
            width: ${is360 ? siteMetricColWidth : siteColWidth}px;
          }
        </style>
        <h2 style="text-align: center; margin: 0 0 4px 0; font-size: 16px; color: #222;">
          ${t('downstream.reportTitle', {
            type: downstream?.downstream_type || '',
            adType: downstream?.ad_type_code || '',
            month: selectedMonth,
          })}
        </h2>
        <p style="text-align: center; margin: 0 0 10px 0; color: #666; font-size: 11px;">
          ${t('downstream.defaultPayout')}: <strong>${basePayoutLabel}%</strong> &nbsp;|&nbsp; ${selectedMonth}
        </p>
        <p style="text-align: center; margin: 0 0 10px 0; color: ${isOfficialView ? '#0f766e' : '#b45309'}; font-size: 11px; font-weight: 600;">
          ${reportNote}
        </p>
        ${renderTable(adSiteIds)}
        <p style="margin-top: 10px; font-size: 10px; color: #aaa; text-align: right;">
          ${t('downstream.reportFooter', {
            date: new Intl.DateTimeFormat(intlLocale).format(new Date()),
          })}
        </p>
      </div>
    `
    const exporter = html2pdf() as any
    exporter.set(opt).from(pdfHTML, 'string').save()
  }

  // Mutation to save effectiveRate to backend
  const saveRateMutation = useMutation({
    mutationFn: ({ date, effectiveRate, downstreamId }: { date: string; effectiveRate: number; downstreamId: number }) =>
      api.post('/api/admin/downstream-rates', {
        downstream_id: downstreamId,
        date: date,
        effective_rate: effectiveRate,
      }),
  })
  const allDays = getDaysInMonth(year, month)

  const adSiteIds = [...new Set(siteInputs.map((r) => r.id))]
  const adSiteNames = new Map(siteInputs.map((r) => [r.id, r.ad_site_name]))
  const sitePrices = new Map(
    siteInputs.map((r) => [r.id, r.resolved_price ?? r.custom_price ?? 0])
  )

  // Map date -> siteId -> input metrics for the selected month
  const dateMap = new Map<string, Map<number, { qty: number; revenue: number }>>()
  for (const row of siteInputs) {
    const inputs = getRowInputs(row)
    for (const input of inputs) {
      if (!input.date || input.qty == null) continue
      const date = input.date
      if (!dateMap.has(date)) {
        dateMap.set(date, new Map())
      }
      dateMap.get(date)!.set(row.id, {
        qty: Number(input.qty ?? 0),
        revenue: Number(input.revenue ?? 0),
      })
    }
  }

  const pivotRows: PivotRow[] = allDays.map((date, dayIndex) => {
    const row: PivotRow = { date, total_uv: 0, total_ml: 0 }
    const effectiveRate = getEffectiveRate(dayIndex, allDays, explicitRates, getDefaultRateForDate)
    let totalUV = 0
    let totalML = 0
    for (const siteId of adSiteIds) {
      const input = dateMap.get(date)?.get(siteId)
      if (input) {
        const pvValue = input.qty
        const adjustedUV = Math.trunc(pvValue * (effectiveRate / 100))
        const amount = input.revenue
        if (is360) {
          const unitPrice = pvValue > 0 ? (amount / pvValue) * 1000 : ''
          row[`${siteId}_pv`] = pvValue
          row[`${siteId}_unit_price`] = unitPrice
          row[`${siteId}_amount`] = amount
        } else {
          row[String(siteId)] = adjustedUV
        }
        totalUV += adjustedUV
        if (isMl360) {
          totalML += amount
        } else if (sitePrices.get(siteId)) {
          totalML += adjustedUV * (sitePrices.get(siteId) ?? 0)
        }
      } else {
        if (is360) {
          row[`${siteId}_pv`] = ''
          row[`${siteId}_unit_price`] = ''
          row[`${siteId}_amount`] = ''
        } else {
          row[String(siteId)] = ''
        }
      }
    }
    row.total_uv = totalUV
    row.total_ml = totalML
    return row
  })

  const pivotColumns: ColumnsType<PivotRow> = withTableEllipsis([
    {
      title: t('downstream.date'),
      dataIndex: 'date',
      key: 'date',
      width: 120,
      fixed: 'left',
      render: (v: string) => <span style={{ whiteSpace: 'nowrap' }}><strong>{v}</strong></span>,
    },
    {
      title: t('downstream.totalUv'),
      dataIndex: 'total_uv',
      key: 'total_uv',
      width: 100,
      render: (v: number) => v > 0 ? formatIsoInteger(v) : '-',
    },
    {
      title: `${t('downstream.totalValue', { type: downstream?.downstream_type || '' })} (${downstream?.ad_type_code || ''})`,
      dataIndex: 'total_ml',
      key: 'total_ml',
      width: 150,
      render: (v: number) => v > 0 ? formatIsoMoney(v) : '-',
    },
    {
      title: `${downstream?.downstream_type || ''}${basePayoutLabel}%`,
      key: 'total_ml_80',
      width: 130,
      render: (_: unknown, row: PivotRow) => {
        const v = row.total_ml * (basePayoutRate / 100)
        return v > 0 ? formatIsoMoney(v) : '-'
      },
    },
    {
      title: (
        <span>{t('downstream.adjustedRate')}</span>
      ),
      key: 'total_ml_pct',
      width: 150,
      render: (_: unknown, row: PivotRow, _index: number) => {
        const effectiveRate = getEffectiveRate(_index, allDays, explicitRates, getDefaultRateForDate)
        const v = row.total_ml * (effectiveRate / 100)
        const isExplicit = explicitRates[row.date] !== undefined
        if (!canEditRates) {
          return (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>{formatIsoNumber(effectiveRate, { maximumFractionDigits: 0 })}%</span>
              <span style={{ color: '#1677ff' }}>{v > 0 ? formatIsoMoney(v) : '-'}</span>
            </span>
          )
        }
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <InputNumber
              min={0}
              max={100}
              value={effectiveRate}
              onChange={(val) => {
                const nextValue = val ?? getDefaultRateForDate(row.date)
                setExplicitRates((prev) => ({
                  ...prev,
                  [row.date]: nextValue,
                }))
                if (downstream?.id && nextValue !== undefined && nextValue !== null) {
                  saveRateMutation.mutate({ date: row.date, effectiveRate: nextValue, downstreamId: downstream!.id })
                }
              }}
              style={{ width: 70, backgroundColor: isExplicit ? '#fffbe6' : undefined }}
              size="small"
            />
            <span style={{ color: '#1677ff' }}>{v > 0 ? formatIsoMoney(v) : '-'}</span>
          </span>
        )
      },
    },
    ...adSiteIds.map((siteId) =>
      is360
        ? {
            title: adSiteNames.get(siteId) ?? String(siteId),
            key: String(siteId),
            children: [
              {
                title: t('downstream.pv'),
                dataIndex: `${siteId}_pv`,
                key: `${siteId}_pv`,
                width: 90,
                render: (v: number | string) => formatDisplayValue(v, formatIsoInteger),
              },
              {
                title: t('downstream.unitPrice'),
                dataIndex: `${siteId}_unit_price`,
                key: `${siteId}_unit_price`,
                width: 110,
                render: (v: number | string) => formatDisplayValue(v, formatIsoMoney),
              },
              {
                title: t('downstream.amount'),
                dataIndex: `${siteId}_amount`,
                key: `${siteId}_amount`,
                width: 120,
                render: (v: number | string) => formatDisplayValue(v, formatIsoMoney),
              },
            ],
          }
        : {
            title: adSiteNames.get(siteId) ?? String(siteId),
            dataIndex: String(siteId),
            key: String(siteId),
            width: 80,
            render: (v: number | string) => (v === '' ? '-' : formatDisplayValue(v, formatIsoInteger)),
          }
    ),
  ])
  const tableWatchKey = [
    id ?? '',
    selectedMonth,
    downstream?.downstream_type ?? '',
    downstream?.ad_type_code ?? '',
    is360 ? '360' : 'std',
    adSiteIds.join('|'),
    pivotRows.length,
  ].join(':')

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link to="/downstream">← {t('downstream.backToList')}</Link>
      </div>
      <h2 style={{ marginBottom: 8 }}>
        {downstream
          ? t('downstream.adSitesOf', {
              type: downstream.downstream_type,
              adType: downstream.ad_type_code,
              count: adSiteIds.length,
            })
          : t('downstream.pageTitle')}
      </h2>

      {isLE ? (
        <LESummaryTable month={leMonth} onMonthChange={setLeMonth} />
      ) : (
        <>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
            <DatePicker.MonthPicker
              value={dayjs(selectedMonth, 'YYYY-MM')}
              onChange={(date) => setSelectedMonth(date ? date.format('YYYY-MM') : dayjs().format('YYYY-MM'))}
              placeholder={t('downstream.monthPlaceholder')}
            />
            <Button type="primary" icon={<DownloadOutlined />} onClick={exportPDF}>{t('downstream.exportPdfMl')}</Button>
            <span style={{ color: isOfficialView ? '#0f766e' : '#b45309', fontSize: 12, alignSelf: 'center' }}>
              {isOfficialView ? t('downstream.officialReportNote') : t('downstream.draftReportNote')}
            </span>
          </div>

          <div ref={tableHostRef} className="dashboard-table-shell">
            <Table
              className="app-data-table dashboard-total-table dashboard-total-table--with-bottom-scroll"
              columns={pivotColumns}
              dataSource={pivotRows}
              rowKey="date"
              size="small"
              bordered
              loading={isLoading}
              pagination={false}
              sticky={{ offsetHeader: 64, offsetScroll: 17 }}
              scroll={{ x: 'max-content' }}
              tableLayout="fixed"
            />
            <DashboardBottomScrollbar tableHostRef={tableHostRef} watchKey={tableWatchKey} leadingOffsetPx={120} />
          </div>
        </>
      )}
    </div>
  )
}
