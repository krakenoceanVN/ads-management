import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, InputNumber, Button, message, Spin, Empty, Alert, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import api, { isAdmin } from '../../api/axios'
import type { DailyInputRow, ApiResponse } from '../../types'
import StatusBadge from '../common/StatusBadge'
import SaveBar from './SaveBar'
import { renderTableText, withTableEllipsis } from '../../utils/tableEllipsis'
import { formatIsoFixed, formatIsoInteger, formatIsoMoney, formatIsoPercent } from '../../utils/numberFormat'

interface Props {
  date: string
  search?: string
}

type DraftOther = Record<number, {
  qty?: number
  unit_price?: number
  amount1?: number
  amount2?: number
  ratio_override?: number
}>

export default function OtherInputTable({ date, search = '' }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [drafts, setDrafts] = useState<DraftOther>({})
  const [errorRows, setErrorRows] = useState<Set<number>>(new Set())
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ['daily-input', 'OTHER', date, search],
    queryFn: () =>
      api.get<ApiResponse<DailyInputRow[]>>('/api/daily-input', { params: { date, ad_type: 'OTHER', search: search || undefined } })
        .then((r) => r.data.data ?? []),
  })

  const getRevenue = (row: DailyInputRow) => {
    if (row.billing_method === 'CPM') {
      const qty = drafts[row.id]?.qty ?? row.existing_record?.qty ?? 0
      const price =
        drafts[row.id]?.unit_price ??
        row.existing_record?.unit_price_snapshot ??
        row.current_unit_price ??
        0
      return qty * price
    } else {
      const a1 = drafts[row.id]?.amount1 ?? row.existing_record?.amount1 ?? 0
      const a2 = drafts[row.id]?.amount2 ?? row.existing_record?.amount2 ?? 0
      const ratio = drafts[row.id]?.ratio_override ?? row.existing_record?.ratio_snapshot ?? row.current_ratio ?? 1
      return (a1 + a2) * ratio
    }
  }

  const isDirty = (row: DailyInputRow) => row.id in drafts
  const isConfirmed = (row: DailyInputRow) => row.existing_record?.status === 'confirmed'

  const mutation = useMutation({
    mutationFn: (records: { ad_site_id: number; qty?: number; unit_price_override?: number; amount1?: number; amount2?: number; ratio_override?: number }[]) =>
      api.post('/api/daily-input/batch', { date, ad_type: 'OTHER', records }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-input', 'OTHER', date] })
      setDrafts({})
      message.success(t('input.saveSuccess'))
    },
    onError: (err: { response?: { status?: number; data?: { errors?: { ad_site_id: number }[] } } }) => {
      if (err.response?.status === 409) {
        message.error(t('input.saveConflict'))
        const errSiteIds = err.response.data?.errors?.map((e) => e.ad_site_id) ?? []
        setErrorRows(new Set(errSiteIds))
        setTimeout(() => setErrorRows(new Set()), 3000)
      } else {
        message.error(t('input.saveFail'))
      }
    },
  })

  const handleSave = useCallback(() => {
    mutation.mutate(
      Object.entries(drafts).map(([id, d]) => ({
        ad_site_id: +id,
        qty: d.qty,
        unit_price_override: d.unit_price,
        amount1: d.amount1,
        amount2: d.amount2,
        ratio_override: d.ratio_override,
      }))
    )
  }, [drafts, mutation])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const groupedRows: { upstream: string; rows: DailyInputRow[] }[] = []
  const upstreamMap = new Map<string, DailyInputRow[]>()
  for (const row of rows) {
    const list = upstreamMap.get(row.upstream_name) ?? []
    list.push(row)
    upstreamMap.set(row.upstream_name, list)
  }
  upstreamMap.forEach((rows, upstream) => groupedRows.push({ upstream, rows }))

  type FlatRow =
    | { _isGroupHeader: true; upstream: string; rowCount: number }
    | { _isGroupHeader: false; _data: DailyInputRow }

  const flatRows: FlatRow[] = []
  for (const group of groupedRows) {
    flatRows.push({ _isGroupHeader: true, upstream: group.upstream, rowCount: group.rows.length })
    for (const row of group.rows) {
      flatRows.push({ _isGroupHeader: false, _data: row })
    }
  }

  type FR = FlatRow & { _isGroupHeader: false }
  const getData = (r: FlatRow): DailyInputRow => (r as FR)._data

  const dirtyCount = Object.keys(drafts).length

  const getCPMColumn = () => ({
    title: t('input.qty'),
    key: 'qty',
    width: 130,
    render: (_: unknown, record: FlatRow) => {
      if ('_isGroupHeader' in record && record._isGroupHeader) return null
      const row = getData(record)
      if (row.billing_method !== 'CPM') return null
      if (isConfirmed(row)) return <span>{formatIsoInteger(row.existing_record?.qty ?? 0)}</span>
      return (
        <InputNumber
          ref={(el) => { inputRefs.current[`${row.id}-qty`] = el as HTMLInputElement | null }}
          size="small"
          precision={0}
          controls={false}
          value={drafts[row.id]?.qty ?? row.existing_record?.qty}
          onChange={(v) =>
            setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], qty: v ?? undefined } }))
          }
          style={{ width: '100%' }}
        />
      )
    },
  })

  const getUnitPriceColumn = () => ({
    title: t('input.unitPrice'),
    key: 'unit_price',
    width: 130,
    render: (_: unknown, record: FlatRow) => {
      if ('_isGroupHeader' in record && record._isGroupHeader) return null
      const row = getData(record)
      if (row.billing_method !== 'CPM') return null
      if (isConfirmed(row)) return <span>{formatIsoFixed(row.existing_record?.unit_price_snapshot ?? row.current_unit_price ?? 0, 4)}</span>
      const admin = isAdmin()
      return (
        <InputNumber
          ref={(el) => { inputRefs.current[`${row.id}-up`] = el as HTMLInputElement | null }}
          size="small"
          precision={4}
          controls={false}
          value={drafts[row.id]?.unit_price ?? row.existing_record?.unit_price_snapshot ?? row.current_unit_price}
          onChange={(v) =>
            setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], unit_price: v ?? undefined } }))
          }
          style={{ width: '100%' }}
          disabled={!admin}
        />
      )
    },
  })

  const getAmount1Column = () => ({
    title: t('input.amount1'),
    key: 'amount1',
    width: 140,
    render: (_: unknown, record: FlatRow) => {
      if ('_isGroupHeader' in record && record._isGroupHeader) return null
      const row = getData(record)
      if (row.billing_method !== 'RATIO') return null
      if (isConfirmed(row)) return <span>{formatIsoMoney(row.existing_record?.amount1 ?? 0)}</span>
      return (
        <InputNumber
          ref={(el) => { inputRefs.current[`${row.id}-a1`] = el as HTMLInputElement | null }}
          size="small"
          precision={2}
          controls={false}
          value={drafts[row.id]?.amount1 ?? row.existing_record?.amount1}
          onChange={(v) =>
            setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], amount1: v ?? undefined } }))
          }
          style={{ width: '100%' }}
        />
      )
    },
  })

  const getAmount2Column = () => ({
    title: t('input.amount2'),
    key: 'amount2',
    width: 140,
    render: (_: unknown, record: FlatRow) => {
      if ('_isGroupHeader' in record && record._isGroupHeader) return null
      const row = getData(record)
      if (row.billing_method !== 'RATIO') return null
      if (isConfirmed(row)) return <span>{formatIsoMoney(row.existing_record?.amount2 ?? 0)}</span>
      return (
        <InputNumber
          ref={(el) => { inputRefs.current[`${row.id}-a2`] = el as HTMLInputElement | null }}
          size="small"
          precision={2}
          controls={false}
          value={drafts[row.id]?.amount2 ?? row.existing_record?.amount2}
          onChange={(v) =>
            setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], amount2: v ?? undefined } }))
          }
          style={{ width: '100%' }}
        />
      )
    },
  })

  const getRatioColumn = () => ({
    title: t('input.ratio'),
    key: 'ratio',
    width: 100,
    render: (_: unknown, record: FlatRow) => {
      if ('_isGroupHeader' in record && record._isGroupHeader) return null
      const row = getData(record)
      if (isConfirmed(row)) return <span>{formatIsoPercent(row.existing_record?.ratio_snapshot ?? row.current_ratio ?? 1)}</span>
      const admin = isAdmin()
      return (
        <InputNumber
          size="small"
          precision={4}
          min={0}
          max={1}
          controls={false}
          value={drafts[row.id]?.ratio_override ?? row.existing_record?.ratio_snapshot ?? row.current_ratio}
          onChange={(v) =>
            setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], ratio_override: v ?? undefined } }))
          }
          style={{ width: '100%' }}
          disabled={!admin}
        />
      )
    },
  })

  const handleStatusActionError = (err: { response?: { data?: { error?: string } } }) => {
    message.error(err.response?.data?.error || t('input.actionFail'))
  }

  const columns: ColumnsType<FlatRow> = withTableEllipsis([
    {
      title: t('input.upstream'),
      dataIndex: 'upstream_name',
      key: 'upstream_name',
      width: 120,
      fixed: 'left',
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return record.upstream
        return getData(record).upstream_name
      },
    },
    {
      title: t('input.adSite'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      fixed: 'left',
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return ''
        return getData(record).name
      },
    },
    {

      title: t('admin.billingMethod'),
      key: 'billing',
      width: 80,
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return null
        const row = getData(record)
        return <Tag color={row.billing_method === 'CPM' ? 'blue' : 'orange'}>{row.billing_method}</Tag>
      },
    },
    getCPMColumn(),
    getUnitPriceColumn(),
    getAmount1Column(),
    getAmount2Column(),
    getRatioColumn(),
    {
      title: t('input.revenue'),
      dataIndex: 'revenue',
      key: 'revenue',
      width: 140,
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return null
        const row = getData(record)
        const revenue = getRevenue(row)
        return (
          <span className="revenue-cell">
            {formatIsoMoney(revenue)}
          </span>
        )
      },
    },
    {
      title: t('input.status'),
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return null
        const row = getData(record)
        const status = row.existing_record?.status ?? 'unconfirmed'
        return <StatusBadge status={status} />
      },
    },
    {
      title: t('input.action'),
      key: 'action',
      width: 80,
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return null
        const row = getData(record)
        const confirmed = isConfirmed(row)
        const id = row.existing_record?.id
        if (!id) return null
        return (
          <Button
            size="small"
            type="link"
            onClick={() => {
              if (confirmed) {
                api.post(`/api/daily-input/${id}/unconfirm`).then(() => {
                  qc.invalidateQueries({ queryKey: ['daily-input', 'OTHER', date] })
                  message.success(t('input.unconfirm') + '!')
                }).catch(handleStatusActionError)
              } else {
                api.post(`/api/daily-input/${id}/confirm`).then(() => {
                  qc.invalidateQueries({ queryKey: ['daily-input', 'OTHER', date] })
                  message.success(t('input.confirm') + '!')
                }).catch(handleStatusActionError)
              }
            }}
          >
            {confirmed ? t('input.unconfirm') : t('input.confirm')}
          </Button>
        )
      },
    },
  ])

  const rowClassName = (record: FlatRow): string => {
    if ('_isGroupHeader' in record && record._isGroupHeader) return 'group-header-row'
    const row = getData(record)
    if (errorRows.has(row.id)) return 'row-error'
    if (isConfirmed(row)) return 'row-confirmed'
    if (isDirty(row)) return 'row-dirty'
    return ''
  }

  const totalQty = rows.reduce(
    (sum: number, row: DailyInputRow) =>
      sum + (row.billing_method === 'CPM' ? (drafts[row.id]?.qty ?? row.existing_record?.qty ?? 0) : 0),
    0,
  )
  const totalRevenue = rows.reduce((s: number, r: DailyInputRow) => s + getRevenue(r), 0)
  const qtyColumnIndex = Math.max(columns.findIndex((column) => column.key === 'qty'), 0)
  const revenueColumnIndex = Math.max(columns.findIndex((column) => column.key === 'revenue'), qtyColumnIndex)
  const middleColumns = columns.slice(qtyColumnIndex + 1, revenueColumnIndex)
  const trailingColumns = columns.slice(revenueColumnIndex + 1)

  return (
    <div>
      {isError && (
        <Alert type="error" message={t('input.loadError')} style={{ marginBottom: 12 }} />
      )}

      <div style={{ position: 'relative' }}>
        {isLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', zIndex: 10 }}>
            <Spin />
          </div>
        )}

        {rows.length === 0 && !isLoading && !isError && (
          <Empty description={t('input.noData')} style={{ padding: 48 }} />
        )}

        {rows.length > 0 && (
          <Table
            className="has-save-bar-table app-data-table"
            columns={columns}
            dataSource={flatRows}
            rowKey={(record: FlatRow) => {
              if ('_isGroupHeader' in record && record._isGroupHeader) return `header-${record.upstream}`
              return String(getData(record).id)
            }}
            size="small"
            bordered
            scroll={{ x: 'max-content' }}
            sticky={{ offsetHeader: 64, offsetScroll: 52 }}
            loading={isLoading}
            rowClassName={rowClassName}
            pagination={false}
            tableLayout="fixed"
            summary={() => (
              <Table.Summary fixed="bottom">
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={qtyColumnIndex}>
                    {renderTableText(t('input.dayTotal'), { fontWeight: 'var(--font-weight-semibold)' })}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={qtyColumnIndex}>
                    {renderTableText(formatIsoInteger(totalQty), { fontWeight: 'var(--font-weight-semibold)' })}
                  </Table.Summary.Cell>
                  {middleColumns.map((column, offset) => (
                    <Table.Summary.Cell
                      key={`middle-${String(column.key ?? qtyColumnIndex + offset + 1)}`}
                      index={qtyColumnIndex + offset + 1}
                    />
                  ))}
                  <Table.Summary.Cell index={revenueColumnIndex}>
                    {renderTableText(formatIsoMoney(totalRevenue), {
                      color: 'var(--color-primary)',
                      fontWeight: 'var(--font-weight-semibold)',
                    })}
                  </Table.Summary.Cell>
                  {trailingColumns.map((column, offset) => (
                    <Table.Summary.Cell
                      key={`tail-${String(column.key ?? revenueColumnIndex + offset + 1)}`}
                      index={revenueColumnIndex + offset + 1}
                    />
                  ))}
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        )}
      </div>

      <SaveBar dirtyCount={dirtyCount} loading={mutation.isPending} onSave={handleSave} />
    </div>
  )
}
