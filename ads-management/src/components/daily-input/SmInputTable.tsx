import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, message, Spin, Empty, Alert } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import api, { isAdmin, canConfirmInput, canInputData } from '../../api/axios'
import type { DailyInputRow, ApiResponse } from '../../types'
import TableNumberInput from '../common/TableNumberInput'
import StatusBadge from '../common/StatusBadge'
import SaveBar from './SaveBar'
import ConfirmAllButton from './ConfirmAllButton'
import UnlockRecordButton from './UnlockRecordButton'
import { renderTableText, withTableEllipsis } from '../../utils/tableEllipsis'
import { formatIsoFixed, formatIsoInteger, formatIsoMoney } from '../../utils/numberFormat'
import { calculateActualRevenue, calculateCpmRevenue, calculateRebateAmount } from '../../utils/calculations'

interface Props {
  date: string
  search?: string
}

type DraftSMItem = {
  qty?: number
  unit_price?: number
  rebate_amount?: number
  actual_revenue?: number
  manual_field?: 'rebate' | 'actual'
}

type DraftSM = Record<number, DraftSMItem>

const ERR_HIGHLIGHT_MS = 3000

export default function SmInputTable({ date, search = '' }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [drafts, setDrafts] = useState<DraftSM>({})
  const [errorRows, setErrorRows] = useState<Set<number>>(new Set())
  const [unlockingId, setUnlockingId] = useState<number | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const admin = isAdmin()
  const canInput = canInputData()
  const canConfirm = canConfirmInput()

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ['daily-input', 'SM', date, search],
    queryFn: () =>
      api.get<ApiResponse<DailyInputRow[]>>('/api/daily-input', { params: { date, ad_type: 'SM', search: search || undefined } })
        .then((r) => r.data.data ?? []),
  })

  const updateDraft = useCallback((rowId: number, patch: Partial<DraftSMItem>) => {
    setDrafts((prev) => {
      const nextRow: DraftSMItem = {
        ...(prev[rowId] ?? {}),
        ...patch,
      }

      if (
        nextRow.qty === undefined &&
        nextRow.unit_price === undefined &&
        nextRow.rebate_amount === undefined &&
        nextRow.actual_revenue === undefined &&
        nextRow.manual_field === undefined
      ) {
        if (!(rowId in prev)) return prev
        const next = { ...prev }
        delete next[rowId]
        return next
      }

      return { ...prev, [rowId]: nextRow }
    })
  }, [])

  const getQty = (row: DailyInputRow) => drafts[row.id]?.qty ?? row.existing_record?.qty ?? 0

  const getUnitPrice = (row: DailyInputRow) =>
    drafts[row.id]?.unit_price ??
    row.existing_record?.unit_price_snapshot ??
    row.current_unit_price ??
    0

  const hasQtyOrPriceDraft = (row: DailyInputRow) =>
    drafts[row.id]?.qty !== undefined || drafts[row.id]?.unit_price !== undefined

  const getConfiguredRebateRate = (row: DailyInputRow) => row.active_rebate_rate ?? 0

  const getBaseRevenue = (row: DailyInputRow) => {
    return calculateCpmRevenue(getQty(row), getUnitPrice(row))
  }

  const getRebateAmount = (row: DailyInputRow) => {
    const draft = drafts[row.id]
    const baseRevenue = getBaseRevenue(row)
    const qty = getQty(row)

    if (draft?.manual_field === 'rebate' && draft.rebate_amount !== undefined) {
      return draft.rebate_amount
    }

    if (draft?.manual_field === 'actual' && draft.actual_revenue !== undefined) {
      return baseRevenue - draft.actual_revenue
    }

    if (!hasQtyOrPriceDraft(row) && row.existing_record) {
      return row.existing_record.rebate_amount ?? 0
    }

    return calculateRebateAmount(qty, getConfiguredRebateRate(row))
  }

  const getActualRevenue = (row: DailyInputRow) => {
    const draft = drafts[row.id]
    const baseRevenue = getBaseRevenue(row)

    if (draft?.manual_field === 'actual' && draft.actual_revenue !== undefined) {
      return draft.actual_revenue
    }

    if (draft?.manual_field === 'rebate' && draft.rebate_amount !== undefined) {
      return calculateActualRevenue(baseRevenue, draft.rebate_amount)
    }

    if (!hasQtyOrPriceDraft(row) && row.existing_record) {
      return row.existing_record.actual_revenue ?? row.existing_record.revenue
    }

    return calculateActualRevenue(baseRevenue, calculateRebateAmount(getQty(row), getConfiguredRebateRate(row)))
  }

  const isDirty = (row: DailyInputRow) => row.id in drafts
  const isConfirmed = (row: DailyInputRow) => row.existing_record?.status === 'confirmed'
  const unconfirmedIds = rows.flatMap((row) =>
    row.existing_record && row.existing_record.status !== 'confirmed' ? [row.existing_record.id] : []
  )

  const mutation = useMutation({
    mutationFn: (records: { ad_site_id: number; qty?: number; unit_price_override?: number; rebate_amount?: number; actual_revenue?: number }[]) =>
      api.post('/api/daily-input/batch', { date, ad_type: 'SM', records }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-input', 'SM', date] })
      setDrafts({})
      message.success(t('input.saveSuccess'))
    },
    onError: (err: { response?: { status?: number; data?: { errors?: { ad_site_id: number }[] } } }) => {
      if (err.response?.status === 409) {
        message.error(t('input.saveConflict'))
        const errSiteIds = err.response.data?.errors?.map((e) => e.ad_site_id) ?? []
        setErrorRows(new Set(errSiteIds))
        setTimeout(() => setErrorRows(new Set()), ERR_HIGHLIGHT_MS)
      } else {
        message.error(t('input.saveFail'))
      }
    },
  })

  const confirmAllMutation = useMutation({
    mutationFn: (ids: number[]) => api.post('/api/daily-input/confirm-batch', { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-input', 'SM', date] })
      message.success(t('input.confirmAllSuccess'))
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      message.error(err.response?.data?.error || t('input.confirmAllFail'))
    },
  })

  const unlockMutation = useMutation({
    mutationFn: (id: number) => api.put(`/api/daily-input/${id}/unconfirm`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-input', 'SM', date] })
      message.success(t('input.unlockSuccess'))
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      message.error(err.response?.data?.error || t('input.unlockFail'))
    },
    onSettled: () => {
      setUnlockingId(null)
    },
  })

  const handleSave = useCallback(() => {
    mutation.mutate(
      Object.entries(drafts).map(([id, d]) => ({
        ad_site_id: +id,
        qty: (d as DraftSM[number]).qty,
        unit_price_override: (d as DraftSM[number]).unit_price,
        rebate_amount: (d as DraftSM[number]).manual_field === 'rebate' ? (d as DraftSM[number]).rebate_amount : undefined,
        actual_revenue: (d as DraftSM[number]).manual_field === 'actual' ? (d as DraftSM[number]).actual_revenue : undefined,
      }))
    )
  }, [drafts, mutation])

  // Keyboard shortcut: Ctrl+S
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

  // Group by upstream
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
      width: 180,
      fixed: 'left',
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return ''
        return getData(record).name
      },
    },
    {
      title: t('input.qty'),
      dataIndex: 'qty',
      key: 'qty',
      width: 130,
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return null
        const row = getData(record)
        if (isConfirmed(row)) {
          return <span>{formatIsoInteger(row.existing_record?.qty ?? 0)}</span>
        }
        return (
          <TableNumberInput
            ref={(el) => { inputRefs.current[`${row.id}-qty`] = el as HTMLInputElement | null }}
            size="small"
            precision={0}
            controls={false}
            value={drafts[row.id]?.qty ?? row.existing_record?.qty}
            onChange={(v) =>
              updateDraft(row.id, { qty: v ?? undefined })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Tab') {
                const el = inputRefs.current[`${row.id}-price`]
                el?.focus()
              }
            }}
            style={{ width: '100%' }}
            disabled={!canInput}
          />
        )
      },
    },
    {
      title: t('input.unitPrice'),
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 120,
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return null
        const row = getData(record)
        const displayPrice = formatIsoFixed(
          drafts[row.id]?.unit_price ?? row.existing_record?.unit_price_snapshot ?? row.current_unit_price ?? 0,
          4,
        )
        if (isConfirmed(row)) {
          const price = row.existing_record?.unit_price_snapshot ?? row.current_unit_price ?? 0
          return <span>{formatIsoFixed(price, 4)}</span>
        }
        const admin = isAdmin()
        if (!admin || !canInput) {
          return <span>{displayPrice}</span>
        }
        return (
          <TableNumberInput
            ref={(el) => { inputRefs.current[`${row.id}-price`] = el as HTMLInputElement | null }}
            size="small"
            precision={4}
            controls={false}
            value={drafts[row.id]?.unit_price ?? row.existing_record?.unit_price_snapshot ?? row.current_unit_price}
            onChange={(v) =>
              updateDraft(row.id, { unit_price: v ?? undefined })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Tab') {
                const nextRow = rows.find((r) => r.id > row.id)
                if (nextRow) {
                  inputRefs.current[`${nextRow.id}-qty`]?.focus()
                }
              }
            }}
            style={{ width: '100%' }}
          />
        )
      },
    },
    {
      title: t('rebate.baseRevenue'),
      dataIndex: 'base_revenue',
      key: 'base_revenue',
      width: 140,
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return null
        const row = getData(record)
        const revenue = getBaseRevenue(row)
        return (
          <span className="revenue-cell">
            {formatIsoMoney(revenue)}
          </span>
        )
      },
    },
    {
      title: t('rebate.rebateAmount'),
      dataIndex: 'rebate_amount',
      key: 'rebate_amount',
      width: 140,
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return null
        const row = getData(record)
        const admin = isAdmin()
        if (admin) {
          return (
            <TableNumberInput
              size="small"
              precision={2}
              controls={false}
              value={getRebateAmount(row)}
              style={{ width: '100%' }}
              disabled
            />
          )
        }
        return <span>{formatIsoMoney(getRebateAmount(row))}</span>
      },
    },
    {
      title: t('rebate.actualRevenue'),
      dataIndex: 'actual_revenue',
      key: 'actual_revenue',
      width: 140,
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return null
        const row = getData(record)
        const admin = isAdmin()
        if (admin) {
          return (
            <TableNumberInput
              size="small"
              precision={2}
              controls={false}
              value={getActualRevenue(row)}
              style={{ width: '100%' }}
              disabled
            />
          )
        }
        return <span>{formatIsoMoney(getActualRevenue(row))}</span>
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
        if (confirmed) {
          if (!admin) return null
          return (
            <UnlockRecordButton
              loading={unlockingId === id && unlockMutation.isPending}
              onConfirm={() => {
                setUnlockingId(id)
                return unlockMutation.mutateAsync(id)
              }}
            />
          )
        }
        if (!canConfirm) return null
        return (
          <Button
            className="app-table-action-button"
            size="small"
            type="link"
            onClick={() => {
              api.post(`/api/daily-input/${id}/confirm`)
                .then(() => {
                  qc.invalidateQueries({ queryKey: ['daily-input', 'SM', date] })
                  message.success(t('input.confirm') + '!')
                })
                .catch((err) => {
                  message.error(err.response?.data?.error || t('input.saveFail'))
                })
            }}
          >
            {t('input.confirm')}
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

  const totalQty = rows.reduce((s: number, r: DailyInputRow) => s + getQty(r), 0)
  const totalBaseRevenue = rows.reduce((s: number, r: DailyInputRow) => s + getBaseRevenue(r), 0)
  const totalRebate = rows.reduce((s: number, r: DailyInputRow) => s + getRebateAmount(r), 0)
  const totalActualRevenue = rows.reduce((s: number, r: DailyInputRow) => s + getActualRevenue(r), 0)
  const qtyColumnIndex = Math.max(columns.findIndex((column) => column.key === 'qty'), 0)
  const baseRevenueColumnIndex = Math.max(columns.findIndex((column) => column.key === 'base_revenue'), qtyColumnIndex)
  const rebateColumnIndex = Math.max(columns.findIndex((column) => column.key === 'rebate_amount'), baseRevenueColumnIndex)
  const actualRevenueColumnIndex = Math.max(columns.findIndex((column) => column.key === 'actual_revenue'), rebateColumnIndex)
  const firstMiddleColumns = columns.slice(qtyColumnIndex + 1, baseRevenueColumnIndex)
  const secondMiddleColumns = columns.slice(baseRevenueColumnIndex + 1, rebateColumnIndex)
  const thirdMiddleColumns = columns.slice(rebateColumnIndex + 1, actualRevenueColumnIndex)
  const trailingColumns = columns.slice(actualRevenueColumnIndex + 1)

  return (
    <div>
      {isError && (
        <Alert type="error" message={t('input.loadError')} style={{ marginBottom: 12 }} />
      )}

      <div className="daily-input-table-actions">
        <ConfirmAllButton
          disabled={unconfirmedIds.length === 0}
          loading={confirmAllMutation.isPending}
          onConfirm={() => confirmAllMutation.mutateAsync(unconfirmedIds)}
        />
      </div>

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
            scroll={{ x: 'max-content', y: 'calc(100vh - 320px)' }}
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
                  {firstMiddleColumns.map((column, offset) => (
                    <Table.Summary.Cell
                      key={`middle-first-${String(column.key ?? qtyColumnIndex + offset + 1)}`}
                      index={qtyColumnIndex + offset + 1}
                    />
                  ))}
                  <Table.Summary.Cell index={baseRevenueColumnIndex}>
                    {renderTableText(formatIsoMoney(totalBaseRevenue), {
                      color: 'var(--color-primary)',
                      fontWeight: 'var(--font-weight-semibold)',
                    })}
                  </Table.Summary.Cell>
                  {secondMiddleColumns.map((column, offset) => (
                    <Table.Summary.Cell
                      key={`middle-second-${String(column.key ?? baseRevenueColumnIndex + offset + 1)}`}
                      index={baseRevenueColumnIndex + offset + 1}
                    />
                  ))}
                  <Table.Summary.Cell index={rebateColumnIndex}>
                    {renderTableText(formatIsoMoney(totalRebate), {
                      color: 'var(--color-danger)',
                      fontWeight: 'var(--font-weight-semibold)',
                    })}
                  </Table.Summary.Cell>
                  {thirdMiddleColumns.map((column, offset) => (
                    <Table.Summary.Cell
                      key={`middle-third-${String(column.key ?? rebateColumnIndex + offset + 1)}`}
                      index={rebateColumnIndex + offset + 1}
                    />
                  ))}
                  <Table.Summary.Cell index={actualRevenueColumnIndex}>
                    {renderTableText(formatIsoMoney(totalActualRevenue), {
                      color: 'var(--color-success)',
                      fontWeight: 'var(--font-weight-semibold)',
                    })}
                  </Table.Summary.Cell>
                  {trailingColumns.map((column, offset) => (
                    <Table.Summary.Cell
                      key={`tail-${String(column.key ?? actualRevenueColumnIndex + offset + 1)}`}
                      index={actualRevenueColumnIndex + offset + 1}
                    />
                  ))}
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        )}
      </div>

      <SaveBar
        dirtyCount={dirtyCount}
        loading={mutation.isPending}
        canSave={canInput}
        disabledReason={t('permission.inputRequired')}
        onSave={handleSave}
      />
    </div>
  )
}
