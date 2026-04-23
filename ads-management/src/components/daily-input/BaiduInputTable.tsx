import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, message, Spin, Empty, Alert } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import api, { isAdmin, canConfirmInput } from '../../api/axios'
import type { DailyInputRow, ApiResponse } from '../../types'
import TableNumberInput from '../common/TableNumberInput'
import StatusBadge from '../common/StatusBadge'
import SaveBar from './SaveBar'
import ConfirmAllButton from './ConfirmAllButton'
import UnlockRecordButton from './UnlockRecordButton'
import { renderTableText, withTableEllipsis } from '../../utils/tableEllipsis'
import { formatIsoMoney, formatIsoPercent } from '../../utils/numberFormat'

interface Props {
  date: string
  search?: string
}

type DraftBaidu = Record<number, { amount1?: number; amount2?: number; ratio_override?: number }>

export default function BaiduInputTable({ date, search = '' }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [drafts, setDrafts] = useState<DraftBaidu>({})
  const [errorRows, setErrorRows] = useState<Set<number>>(new Set())
  const [unlockingId, setUnlockingId] = useState<number | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const admin = isAdmin()
  const canConfirm = canConfirmInput()

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ['daily-input', 'BAIDU_JS', date, search],
    queryFn: () =>
      api.get<ApiResponse<DailyInputRow[]>>('/api/daily-input', { params: { date, ad_type: 'BAIDU_JS', search: search || undefined } })
        .then((r) => r.data.data ?? []),
  })

  const getRevenue = (row: DailyInputRow) => {
    const a1 = drafts[row.id]?.amount1 ?? row.existing_record?.amount1 ?? 0
    const a2 = drafts[row.id]?.amount2 ?? row.existing_record?.amount2 ?? 0
    const ratio = drafts[row.id]?.ratio_override ?? row.existing_record?.ratio_snapshot ?? row.current_ratio ?? 1
    return (a1 + a2) * ratio
  }

  const isDirty = (row: DailyInputRow) => row.id in drafts
  const isConfirmed = (row: DailyInputRow) => row.existing_record?.status === 'confirmed'
  const unconfirmedIds = rows.flatMap((row) =>
    row.existing_record && row.existing_record.status !== 'confirmed' ? [row.existing_record.id] : []
  )

  const mutation = useMutation({
    mutationFn: (records: { ad_site_id: number; amount1?: number; amount2?: number; ratio_override?: number }[]) =>
      api.post('/api/daily-input/batch', { date, ad_type: 'BAIDU_JS', records }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-input', 'BAIDU_JS', date] })
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

  const confirmAllMutation = useMutation({
    mutationFn: (ids: number[]) => api.post('/api/daily-input/confirm-batch', { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-input', 'BAIDU_JS', date] })
      message.success(t('input.confirmAllSuccess'))
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      message.error(err.response?.data?.error || t('input.confirmAllFail'))
    },
  })

  const unlockMutation = useMutation({
    mutationFn: (id: number) => api.put(`/api/daily-input/${id}/unconfirm`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-input', 'BAIDU_JS', date] })
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
        amount1: (d as DraftBaidu[number]).amount1,
        amount2: (d as DraftBaidu[number]).amount2,
        ratio_override: (d as DraftBaidu[number]).ratio_override,
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
      title: t('input.amount1'),
      dataIndex: 'amount1',
      key: 'amount1',
      width: 140,
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return null
        const row = getData(record)
        if (isConfirmed(row)) return <span>{formatIsoMoney(row.existing_record?.amount1 ?? 0)}</span>
        return (
          <TableNumberInput
            ref={(el) => { inputRefs.current[`${row.id}-a1`] = el as HTMLInputElement | null }}
            size="small"
            precision={2}
            controls={false}
            value={drafts[row.id]?.amount1 ?? row.existing_record?.amount1}
            onChange={(v) =>
              setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], amount1: v ?? undefined } }))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Tab') {
                inputRefs.current[`${row.id}-a2`]?.focus()
              }
            }}
            style={{ width: '100%' }}
          />
        )
      },
    },
    {
      title: t('input.amount2'),
      dataIndex: 'amount2',
      key: 'amount2',
      width: 140,
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return null
        const row = getData(record)
        if (isConfirmed(row)) return <span>{formatIsoMoney(row.existing_record?.amount2 ?? 0)}</span>
        return (
          <TableNumberInput
            ref={(el) => { inputRefs.current[`${row.id}-a2`] = el as HTMLInputElement | null }}
            size="small"
            precision={2}
            controls={false}
            value={drafts[row.id]?.amount2 ?? row.existing_record?.amount2}
            onChange={(v) =>
              setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], amount2: v ?? undefined } }))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Tab') {
                const nextRow = rows.find((r) => r.id > row.id)
                if (nextRow) inputRefs.current[`${nextRow.id}-a1`]?.focus()
              }
            }}
            style={{ width: '100%' }}
          />
        )
      },
    },
    {
      title: t('input.ratio'),
      key: 'ratio',
      width: 100,
      render: (_: unknown, record: FlatRow) => {
        if ('_isGroupHeader' in record && record._isGroupHeader) return null
        const row = getData(record)
        if (isConfirmed(row)) return <span>{formatIsoPercent(row.existing_record?.ratio_snapshot ?? row.current_ratio ?? 1)}</span>
        const admin = isAdmin()
        return (
          <TableNumberInput
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
    },
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
                  qc.invalidateQueries({ queryKey: ['daily-input', 'BAIDU_JS', date] })
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

  const totalRevenue = rows.reduce((s: number, r: DailyInputRow) => s + getRevenue(r), 0)
  const revenueColumnIndex = Math.max(columns.findIndex((column) => column.key === 'revenue'), 0)
  const trailingColumns = columns.slice(revenueColumnIndex + 1)

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
            scroll={{ x: 'max-content' }}
            sticky={{ offsetHeader: 64, offsetScroll: 52 }}
            loading={isLoading}
            rowClassName={rowClassName}
            pagination={false}
            tableLayout="fixed"
            summary={() => (
              <Table.Summary fixed="bottom">
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={revenueColumnIndex}>
                    {renderTableText(t('input.dayTotal'), { fontWeight: 'var(--font-weight-semibold)' })}
                  </Table.Summary.Cell>
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

      <SaveBar
        dirtyCount={dirtyCount}
        loading={mutation.isPending}
        canSave={admin}
        disabledReason={t('permission.adminRequired')}
        onSave={handleSave}
      />
    </div>
  )
}
