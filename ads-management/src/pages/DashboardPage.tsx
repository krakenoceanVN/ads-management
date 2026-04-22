import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { DatePicker, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import type { SummaryRow, AdTypeCode, ApiResponse } from '../types'
import MoneyCell from '../components/dashboard/MoneyCell'
import DashboardBottomScrollbar from '../components/dashboard/DashboardBottomScrollbar'
import KpiValueText from '../components/dashboard/KpiValueText'
import { renderTableText, withTableEllipsis } from '../utils/tableEllipsis'
import { formatIsoMoney } from '../utils/numberFormat'

interface Props {
  adType: AdTypeCode
}

const AD_TYPE_LABEL: Record<AdTypeCode, string> = {
  SM: 'SM',
  '360': '360',
  BAIDU_JS: 'Baidu JS',
  OTHER: 'Other',
}

const AD_TYPE_URL_MAP: Record<AdTypeCode, string> = {
  SM: 'sm',
  '360': '360',
  BAIDU_JS: 'baidu',
  OTHER: 'other',
}

const DOWNSTREAM_COLUMNS: Record<AdTypeCode, { key: string; label: string }[]> = {
  SM: [],
  '360': [],
  BAIDU_JS: [],
  OTHER: [],
}

type FR = SummaryRow & { _isTotal?: boolean }

export default function DashboardRoutePage({ adType }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const today = dayjs()
  const tableHostRef = useRef<HTMLDivElement | null>(null)
  const [year, setYear] = useState(today.year())
  const [month, setMonth] = useState(today.month() + 1)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['dashboard', adType, year, month],
    queryFn: () =>
      api.get<ApiResponse<SummaryRow[]>>('/api/dashboard/monthly', {
        params: { year, month, ad_type: adType },
      }).then((r) => r.data.data ?? []),
  })

  const displayRows = rows.filter((r) => r.date !== 'TOTAL')
  const totalRow = rows.find((r) => r.date === 'TOTAL') ?? rows[rows.length - 1]

  const upstreamCols = useMemo(() => {
    const names = new Set<string>()
    rows.forEach((row) => {
      Object.keys(row.upstream_breakdown ?? {}).forEach((name) => names.add(name))
    })
    return Array.from(names)
  }, [rows])
  const downstreamCols = DOWNSTREAM_COLUMNS[adType]

  const monthLabel = `${year}-${String(month).padStart(2, '0')}`

  const totalRevenue = totalRow?.revenue ?? 0
  const totalCost = totalRow?.cost ?? 0
  const totalProfit = totalRevenue - totalCost
  const totalTax = totalRow?.tax ?? 0
  const totalNetProfit = (totalRow?.profit ?? totalProfit) - totalTax
  const tableWatchKey = [
    adType,
    year,
    month,
    upstreamCols.join('|'),
    downstreamCols.map(({ key }) => key).join('|'),
    rows.length,
  ].join(':')
  const tableScrollX = 120 + upstreamCols.length * 110 + downstreamCols.length * 110 + 80
  const getUpstream = (row: SummaryRow, name: string) =>
    row.upstream_breakdown?.[name] ?? 0

  const getDownstream = (row: SummaryRow, key: string) =>
    (row as unknown as Record<string, number | undefined>)[key] ?? 0

  const columns: ColumnsType<FR> = withTableEllipsis([
    {
      title: t('dashboard.date'),
      dataIndex: 'date',
      key: 'date',
      width: 120,
      fixed: 'left',
      className: 'dashboard-date-col',
      render: (val: string) => {
        if (val === 'TOTAL') return <strong>{t('dashboard.total')}</strong>
        return (
          <a
            className="dashboard-date-link"
            style={{ whiteSpace: 'nowrap', display: 'inline-block' }}
            onClick={() =>
              navigate(`/input/${AD_TYPE_URL_MAP[adType]}?date=${val}`)
            }
          >
            {val}
          </a>
        )
      },
    },
    ...upstreamCols.map((name) => ({
      title: name,
      key: `up_${name}`,
      width: 110,
      render: (_: unknown, row: FR) => {
        if (row.date === 'TOTAL') {
          const total = rows
            .slice(0, -1)
            .reduce((s, r) => s + (r.upstream_breakdown?.[name] ?? 0), 0)
          return <MoneyCell value={total} />
        }
        return <MoneyCell value={getUpstream(row, name)} />
      },
    })),
    ...downstreamCols.map(({ key, label }) => ({
      title: label,
      key: `ds_${key}`,
      width: 110,
      render: (_: unknown, row: FR) => {
        if (row.date === 'TOTAL') {
          const total = rows
            .slice(0, -1)
            .reduce(
              (s, r) => s + ((r as unknown as Record<string, number | undefined>)[key] ?? 0),
              0
            )
          return <MoneyCell value={total} />
        }
        return <MoneyCell value={getDownstream(row, key)} />
      },
    })),
  ])

  return (
    <div className="page-shell dashboard-page-shell">
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
        <span className="page-subtitle">
          {t('dashboard.title', { type: AD_TYPE_LABEL[adType] })}
        </span>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card revenue">
          <div className="kpi-icon revenue">💰</div>
          <div className="kpi-label">{t('dashboard.totalRevenue')}</div>
          <KpiValueText value={formatIsoMoney(totalRevenue)} />
          <div className="kpi-sub">{monthLabel}</div>
        </div>

        <div className="kpi-card expense">
          <div className="kpi-icon expense">📤</div>
          <div className="kpi-label">{t('dashboard.totalCost')}</div>
          <KpiValueText value={formatIsoMoney(totalCost)} />
          <div className="kpi-sub">{monthLabel}</div>
        </div>

        <div className="kpi-card profit">
          <div className="kpi-icon profit">📊</div>
          <div className="kpi-label">{t('dashboard.profitLabel')}</div>
          <KpiValueText value={formatIsoMoney(totalProfit)} />
          <div className="kpi-sub">{t('dashboard.summaryTitle')}</div>
        </div>

        <div className="kpi-card net">
          <div className="kpi-icon net">🌿</div>
          <div className="kpi-label">{t('dashboard.netProfitLabel')}</div>
          <KpiValueText value={formatIsoMoney(totalNetProfit)} />
          <div className="kpi-sub">{monthLabel}</div>
        </div>
      </div>

      <div ref={tableHostRef} className="dashboard-table-shell">
        <Table<FR>
          className="app-data-table dashboard-total-table dashboard-total-table--with-bottom-scroll"
          columns={columns}
          dataSource={displayRows as FR[]}
          rowKey="date"
          size="small"
          bordered
          sticky={{ offsetHeader: 64, offsetScroll: 17 }}
          scroll={{ x: tableScrollX }}
          loading={isLoading}
          pagination={false}
          tableLayout="fixed"
          summary={() => {
            if (!totalRow) return null

            return (
              <Table.Summary fixed="bottom">
                <Table.Summary.Row className="dashboard-total-summary-row">
                  <Table.Summary.Cell index={0} className="dashboard-total-cell dashboard-date-col">
                    {renderTableText(t('dashboard.total'), { fontWeight: 'var(--font-weight-semibold)' })}
                  </Table.Summary.Cell>

                  {upstreamCols.map((name, idx) => (
                    <Table.Summary.Cell key={`sum-up-${name}`} index={idx + 1} className="dashboard-total-cell">
                      <MoneyCell value={totalRow.upstream_breakdown?.[name] ?? 0} />
                    </Table.Summary.Cell>
                  ))}

                  {downstreamCols.map(({ key }, idx) => {
                    const total = displayRows.reduce(
                      (s, r) => s + ((r as unknown as Record<string, number | undefined>)[key] ?? 0),
                      0
                    )

                    return (
                      <Table.Summary.Cell key={`sum-ds-${key}`} index={upstreamCols.length + idx + 1} className="dashboard-total-cell">
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
