import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { DatePicker, Table, Tabs } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import api from '../api/axios'
import type { SummaryRow, AdTypeCode, ApiResponse } from '../types'
import MoneyCell from '../components/dashboard/MoneyCell'
import DashboardBottomScrollbar from '../components/dashboard/DashboardBottomScrollbar'
import KpiValueText from '../components/dashboard/KpiValueText'
import { renderTableText, withTableEllipsis } from '../utils/tableEllipsis'
import { formatIsoInteger, formatIsoMoney, formatIsoPercent } from '../utils/numberFormat'

interface Props {
  adType?: AdTypeCode
}

interface DownstreamRow {
  date: string
  ml: number
  ml_80: number
  le: number
}

interface LeDashboardRow {
  date: string
  leRevenue: number
  isTotal?: boolean
}

interface LeDashboardResponse {
  upstreamNames: string[]
  rows: LeDashboardRow[]
}

interface UpstreamDetailMetrics {
  pv: number
  unit_price: number
  amount: number
}

const AD_TYPE_TABS: { key: string; adType: AdTypeCode; labelKey: string }[] = [
  { key: 'tab-sm', adType: 'SM', labelKey: 'adType.gsSm' },
  { key: 'tab-360', adType: '360', labelKey: 'adType.360' },
  { key: 'tab-baidu', adType: 'BAIDU_JS', labelKey: 'adType.baidu' },
  { key: 'tab-other', adType: 'OTHER', labelKey: 'adType.other' },
]

const UPSTREAM_COLUMNS: Record<AdTypeCode, string[]> = {
  SM: [],
  '360': [],
  BAIDU_JS: [],
  OTHER: [],
}

const DOWNSTREAM_COLUMNS: Record<AdTypeCode, { key: string; label: string }[]> = {
  SM: [
    { key: 'ml_80', label: 'ML 80%' },
    { key: 'le', label: 'LE' },
  ],
  '360': [
    { key: 'ml_80', label: 'ML 80%' },
    { key: 'le', label: 'LE' },
  ],
  BAIDU_JS: [
    { key: 'ml_80', label: 'ML 80%' },
    { key: 'le', label: 'LE' },
  ],
  OTHER: [
    { key: 'ml_80', label: 'ML 80%' },
    { key: 'le', label: 'LE' },
  ],
}

type FR = SummaryRow & { _isTotal?: boolean; ml_80?: number; le?: number }

function emptyUpstreamDetailMetrics(): UpstreamDetailMetrics {
  return { pv: 0, unit_price: 0, amount: 0 }
}

function buildTotalUpstreamDetailBreakdown(rows: FR[]): Record<string, UpstreamDetailMetrics> {
  const aggregated: Record<string, UpstreamDetailMetrics> = {}

  for (const row of rows) {
    for (const [name, metrics] of Object.entries(row.upstream_detail_breakdown ?? {})) {
      const current = aggregated[name] ?? emptyUpstreamDetailMetrics()
      current.pv += metrics.pv ?? 0
      current.amount += metrics.amount ?? 0
      aggregated[name] = current
    }
  }

  for (const metrics of Object.values(aggregated)) {
    metrics.unit_price = metrics.pv > 0 ? (metrics.amount / metrics.pv) * 1000 : 0
  }

  return aggregated
}

function formatPv(value: number): string {
  return formatIsoInteger(value)
}

function calculateMl80(adType: AdTypeCode, revenue: number, downstreamMl80 = 0): number {
  if (adType === '360') {
    return revenue * 0.8
  }

  return downstreamMl80
}

function AdTypeDashboard({ adType, year, month }: { adType: AdTypeCode; year: number; month: number }) {
  const { t } = useTranslation()
  const tableHostRef = useRef<HTMLDivElement | null>(null)
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['upstream-dashboard', adType, year, month],
    queryFn: () =>
      api.get<ApiResponse<SummaryRow[]>>('/api/dashboard/monthly', {
        params: { year, month, ad_type: adType },
      }).then((r) => r.data.data ?? []),
  })

  const { data: downstreamRows = [], isLoading: isDownstreamLoading } = useQuery({
    queryKey: ['downstream-dashboard', adType, year, month],
    queryFn: () =>
      api.get<ApiResponse<DownstreamRow[]>>('/api/dashboard/downstream-monthly', {
        params: { year, month, ad_type: adType },
      }).then((r) => r.data.data ?? []),
  })

  const { data: leDashboardData, isLoading: isLeDashboardLoading } = useQuery({
    queryKey: ['le-dashboard-summary-link', monthKey],
    queryFn: () =>
      api.get<ApiResponse<LeDashboardResponse>>('/api/dashboard/le', {
        params: { month: monthKey },
      }).then((r) => r.data.data),
    enabled: adType === 'SM',
  })

  const leDashboardRows = (leDashboardData?.rows ?? []).filter((row) => !row.isTotal && row.date !== 'TOTAL')
  const leRevenueByDate = new Map(leDashboardRows.map((row) => [row.date, row.leRevenue]))

  const displayRows: FR[] = rows
    .filter((r) => r.date !== 'TOTAL')
    .map((r) => {
      const downstream = downstreamRows.find((d) => d.date === r.date)
      const ml80 = calculateMl80(adType, r.revenue, downstream?.ml_80 ?? 0)
      const le = adType === 'SM'
        ? (leRevenueByDate.get(r.date) ?? 0)
        : (downstream?.le ?? 0)

      return {
        ...r,
        ml_80: ml80,
        le,
      }
    })

  const totalRevenue = displayRows.reduce((sum, row) => sum + row.revenue, 0)
  const totalML80 = displayRows.reduce((sum, row) => sum + (row.ml_80 ?? 0), 0)
  const totalLE = displayRows.reduce((sum, row) => sum + (row.le ?? 0), 0)
  const totalCost = displayRows.reduce((sum, row) => sum + row.cost, 0)
  const totalTax = displayRows.reduce((sum, row) => sum + row.tax, 0)
  const totalNetProfit = displayRows.reduce((sum, row) => sum + row.profit, 0)
  const upstreamCols = UPSTREAM_COLUMNS[adType]
  const downstreamCols = DOWNSTREAM_COLUMNS[adType]

  const totalGrossProfit = totalRevenue - totalCost
  const totalProfitRate = totalRevenue > 0 ? totalNetProfit / totalRevenue : 0
  const totalUpstreamBreakdown = displayRows.reduce<Record<string, number>>((acc, row) => {
    for (const [name, value] of Object.entries(row.upstream_breakdown ?? {})) {
      acc[name] = (acc[name] ?? 0) + value
    }
    return acc
  }, {})
  const totalUpstreamDetailBreakdown = buildTotalUpstreamDetailBreakdown(displayRows)
  const upstreamDetailNames = adType === '360'
    ? Array.from(new Set(displayRows.flatMap((row) => Object.keys(row.upstream_detail_breakdown ?? {}))))
    : []
  const upstreamLeafCount = adType === '360' ? upstreamDetailNames.length * 3 : upstreamCols.length

  const monthLabel = monthKey

  const tableWatchKey = [
    adType,
    year,
    month,
    upstreamCols.join('|'),
    downstreamCols.map(({ key }) => key).join('|'),
    displayRows.length,
  ].join(':')

  const columns: ColumnsType<FR> = withTableEllipsis([
    {
      title: t('dashboard.date'),
      dataIndex: 'date',
      key: 'date',
      width: 90,
      fixed: 'left',
      className: 'dashboard-date-col',
      render: (val: string) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {val === 'TOTAL' ? <strong>{t('dashboard.total')}</strong> : val}
        </span>
      ),
    },
    {
      title: t('dashboard.revenue'),
      dataIndex: 'revenue',
      key: 'revenue',
      width: 110,
      render: (v: number) => <MoneyCell value={v} />,
    },
    {
      title: t('dashboard.cost'),
      key: 'cost',
      width: 110,
      dataIndex: 'cost',
      render: (v: number) => <MoneyCell value={v} />,
    },
    {
      title: t('dashboard.profit'),
      key: 'profit',
      width: 110,
      render: (_: unknown, row: FR) => <MoneyCell value={row.revenue - row.cost} colorize />,
    },
    {
      title: t('dashboard.tax'),
      key: 'tax',
      width: 90,
      dataIndex: 'tax',
      render: (v: number) => <MoneyCell value={v} />,
    },
    {
      title: t('dashboard.netProfit'),
      key: 'net_profit',
      width: 110,
      dataIndex: 'profit',
      render: (v: number) => <MoneyCell value={v} colorize />,
    },
    {
      title: t('dashboard.profitRate'),
      key: 'profit_rate',
      width: 80,
      dataIndex: 'profit_rate',
      render: (v: number) => formatIsoPercent(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    },
    ...(adType === '360'
      ? upstreamDetailNames.map((name) => ({
          title: name,
          key: `up_${name}`,
          children: [
            {
              title: t('downstream.pv'),
              key: `up_${name}_pv`,
              width: 100,
              render: (_: unknown, row: FR) => formatPv(row.upstream_detail_breakdown?.[name]?.pv ?? 0),
            },
            {
              title: t('downstream.unitPrice'),
              key: `up_${name}_unit_price`,
              width: 110,
              render: (_: unknown, row: FR) => <MoneyCell value={row.upstream_detail_breakdown?.[name]?.unit_price ?? 0} />,
            },
            {
              title: t('downstream.amount'),
              key: `up_${name}_amount`,
              width: 120,
              render: (_: unknown, row: FR) => <MoneyCell value={row.upstream_detail_breakdown?.[name]?.amount ?? 0} />,
            },
          ],
        }))
      : upstreamCols.map((name) => ({
          title: name,
          key: `up_${name}`,
          width: 100,
          render: (_: unknown, row: FR) => <MoneyCell value={row.upstream_breakdown?.[name] ?? 0} />,
        }))),
    ...downstreamCols.map(({ key, label }) => ({
      title: label,
      key: `ds_${key}`,
      width: 100,
      render: (_: unknown, row: FR) => {
        return <MoneyCell value={(row as unknown as Record<string, number | undefined>)[key] ?? 0} />
      },
    })),
  ])

  const summaryCards = [
    { key: 'revenue', label: t('dashboard.totalRevenue'), value: totalRevenue, color: 'var(--color-primary)' },
    { key: 'cost', label: t('dashboard.totalCost'), value: totalCost, color: 'var(--color-danger)' },
    { key: 'profit', label: t('dashboard.profitLabel'), value: totalGrossProfit, color: 'var(--color-warning)' },
    { key: 'net', label: t('dashboard.netProfit'), value: totalNetProfit, color: 'var(--color-success)' },
    { key: 'ml80', label: 'ML 80%', value: totalML80, color: 'var(--color-primary)' },
    { key: 'le', label: 'LE', value: totalLE, color: 'var(--color-text-primary)' },
  ]

  return (
    <div className="page-shell dashboard-page-shell">
      {/* Summary Cards */}
      <div className="kpi-grid">
        {summaryCards.map((card) => {
          let typeClass = 'net'
          let icon = '🌿'
          if (card.key === 'revenue') { typeClass = 'revenue'; icon = '💰' }
          if (card.key === 'cost') { typeClass = 'expense'; icon = '📤' }
          if (card.key === 'profit') { typeClass = 'profit'; icon = '📊' }
          if (card.key === 'ml80') { typeClass = 'revenue'; icon = '💎' }
          if (card.key === 'le') { typeClass = 'profit'; icon = '🌟' }
          
          return (
            <div key={card.key} className={`kpi-card ${typeClass}`}>
              <div className={`kpi-icon ${typeClass}`}>{icon}</div>
              <div className="kpi-label">{card.label}</div>
              <KpiValueText value={formatIsoMoney(card.value)} />
              <div className="kpi-sub">{monthLabel}</div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div ref={tableHostRef} className="dashboard-table-shell">
        <Table<FR>
          columns={columns}
          dataSource={displayRows}
          rowKey="date"
          size="small"
          bordered
          className="app-data-table dashboard-total-table dashboard-total-table--with-bottom-scroll date-col-fixed-90"
          scroll={{ x: 'max-content' }}
          sticky={{ offsetHeader: 64, offsetScroll: 17 }}
          loading={isLoading || isDownstreamLoading || isLeDashboardLoading}
          pagination={false}
          tableLayout="fixed"
          summary={() => {
            if (displayRows.length === 0) return null

            return (
              <Table.Summary fixed="bottom">
                <Table.Summary.Row className="dashboard-total-summary-row">
                  <Table.Summary.Cell index={0} className="dashboard-total-cell dashboard-date-col">
                    {renderTableText(t('dashboard.total'), { fontWeight: 'var(--font-weight-semibold)' })}
                  </Table.Summary.Cell>

                  <Table.Summary.Cell index={1} className="dashboard-total-cell">
                    <MoneyCell value={totalRevenue} />
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} className="dashboard-total-cell">
                    <MoneyCell value={totalCost} />
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} className="dashboard-total-cell">
                    <MoneyCell value={totalGrossProfit} colorize />
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} className="dashboard-total-cell">
                    <MoneyCell value={totalTax} />
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} className="dashboard-total-cell">
                    <MoneyCell value={totalNetProfit} colorize />
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} className="dashboard-total-cell">
                    {renderTableText(
                      formatIsoPercent(totalProfitRate, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                    )}
                  </Table.Summary.Cell>

                  {adType === '360'
                    ? upstreamDetailNames.flatMap((name, idx) => {
                        const metrics = totalUpstreamDetailBreakdown[name] ?? emptyUpstreamDetailMetrics()
                        const startIndex = 7 + idx * 3

                        return [
                          <Table.Summary.Cell key={`sum-up-${name}-pv`} index={startIndex} className="dashboard-total-cell">
                            {renderTableText(formatPv(metrics.pv), { fontWeight: 'var(--font-weight-semibold)' })}
                          </Table.Summary.Cell>,
                          <Table.Summary.Cell key={`sum-up-${name}-unit`} index={startIndex + 1} className="dashboard-total-cell">
                            <MoneyCell value={metrics.unit_price} />
                          </Table.Summary.Cell>,
                          <Table.Summary.Cell key={`sum-up-${name}-amount`} index={startIndex + 2} className="dashboard-total-cell">
                            <MoneyCell value={metrics.amount} />
                          </Table.Summary.Cell>,
                        ]
                      })
                    : upstreamCols.map((name, idx) => (
                        <Table.Summary.Cell key={`sum-up-${name}`} index={7 + idx} className="dashboard-total-cell">
                          <MoneyCell value={totalUpstreamBreakdown[name] ?? 0} />
                        </Table.Summary.Cell>
                      ))}

                  {downstreamCols.map(({ key }, idx) => {
                    const total = key === 'ml_80' ? totalML80 : key === 'le' ? totalLE : 0

                    return (
                      <Table.Summary.Cell key={`sum-ds-${key}`} index={7 + upstreamLeafCount + idx} className="dashboard-total-cell">
                        <MoneyCell value={total} />
                      </Table.Summary.Cell>
                    )
                  })}
                </Table.Summary.Row>
              </Table.Summary>
            )
          }}
        />
        <DashboardBottomScrollbar tableHostRef={tableHostRef} watchKey={tableWatchKey} />
      </div>
    </div>
  )
}

export default function SummaryDashboardPage({ adType }: Props) {
  const { t } = useTranslation()
  const today = dayjs()
  const [year, setYear] = useState(today.year())
  const [month, setMonth] = useState(today.month() + 1)
  const [activeTab, setActiveTab] = useState('tab-sm')

  // If adType is provided (route /upstream/sm etc), show single dashboard
  // Otherwise show tabs (route /upstream)
  const showTabs = !adType

  return (
    <div className="page-shell">
      <div className="page-toolbar">
        <DatePicker.MonthPicker
          value={dayjs(`${year}-${String(month).padStart(2, '0')}-01`)}
          onChange={(d) => {
            if (d) {
              setYear(d.year())
              setMonth(d.month() + 1)
            }
          }}
          allowClear={false}
        />
        <span className="page-subtitle">{t('dashboard.summaryTitle')}</span>
      </div>

      {showTabs ? (
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k)}
          items={AD_TYPE_TABS.map(({ key, adType: at, labelKey }) => ({
            key,
            label: t(labelKey),
            children: <AdTypeDashboard key={`${key}-${year}-${month}`} adType={at} year={year} month={month} />,
          }))}
        />
      ) : (
        <AdTypeDashboard key={`${adType}-${year}-${month}`} adType={adType} year={year} month={month} />
      )}
    </div>
  )
}
