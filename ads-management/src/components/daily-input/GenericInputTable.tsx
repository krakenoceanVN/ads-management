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
import { withTableEllipsis } from '../../utils/tableEllipsis'
import { formatIsoInteger, formatIsoMoney } from '../../utils/numberFormat'

interface Props {
    date: string
    adType: string
    search?: string
}

type DraftGeneric = Record<number, {
    qty?: number
    unit_price?: number
    amount1?: number
    amount2?: number
    ratio_override?: number
}>

export default function GenericInputTable({ date, adType, search = '' }: Props) {
    const { t } = useTranslation()
    const qc = useQueryClient()
    const [drafts, setDrafts] = useState<DraftGeneric>({})
    const [errorRows, setErrorRows] = useState<Set<number>>(new Set())
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
    const admin = isAdmin()
    const canConfirm = canConfirmInput()

    const { data: rows = [], isLoading, isError } = useQuery({
        queryKey: ['daily-input', adType, date, search],
        queryFn: () =>
            api.get<ApiResponse<DailyInputRow[]>>('/api/daily-input', { params: { date, ad_type: adType, search: search || undefined } })
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
    const unconfirmedIds = rows.flatMap((row) =>
        row.existing_record && row.existing_record.status !== 'confirmed' ? [row.existing_record.id] : []
    )

    const mutation = useMutation({
        mutationFn: (records: { ad_site_id: number; qty?: number; unit_price_override?: number; amount1?: number; amount2?: number; ratio_override?: number }[]) =>
            api.post('/api/daily-input/batch', { date, ad_type: adType, records }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['daily-input', adType, date] })
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
            qc.invalidateQueries({ queryKey: ['daily-input', adType, date] })
            message.success(t('input.confirmAllSuccess'))
        },
        onError: (err: { response?: { data?: { error?: string } } }) => {
            message.error(err.response?.data?.error || t('input.confirmAllFail'))
        },
    })

    const handleSave = useCallback(() => {
        const records = Object.entries(drafts).map(([id, d]) => ({
            ad_site_id: parseInt(id),
            qty: d.qty,
            unit_price_override: d.unit_price,
            amount1: d.amount1,
            amount2: d.amount2,
            ratio_override: d.ratio_override,
        }))
        mutation.mutate(records)
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

    const updateDraft = useCallback((rowId: number, patch: Partial<DraftGeneric[number]>) => {
        setDrafts((prev) => {
            const nextRow = { ...(prev[rowId] ?? {}), ...patch }
            const hasValue = Object.values(nextRow).some((v) => v !== undefined)
            if (!hasValue) {
                const next = { ...prev }
                delete next[rowId]
                return next
            }
            return { ...prev, [rowId]: nextRow }
        })
    }, [])

    const rowClassName = (record: DailyInputRow): string => {
        const classes = ['daily-input-row']
        if (isDirty(record)) classes.push('dirty')
        if (record.existing_record?.status === 'confirmed') classes.push('confirmed')
        if (errorRows.has(record.id)) classes.push('error')
        return classes.join(' ')
    }

    const qtyColumnIndex = 4
    const revenueColumnIndex = 5
    const middleColumns = [
        { title: t('input.upstream'), dataIndex: 'upstream_name', key: 'upstream_name', width: 120 },
        { title: t('input.adSite'), dataIndex: 'name', key: 'name', width: 180 },
        { title: t('admin.billingMethod'), dataIndex: 'billing_method', key: 'billing_method', width: 80 },
    ]

    const trailingColumns = [
        {
            title: t('input.status'),
            key: 'status',
            width: 90,
            render: (_: unknown, record: DailyInputRow) => (
                record.existing_record?.status
                    ? <StatusBadge status={record.existing_record.status} />
                    : <span className="text-muted">—</span>
            )
        },
        {
            title: t('input.action'),
            key: 'action',
            width: 80,
            render: (_: unknown, record: DailyInputRow) => (
                record.existing_record && record.existing_record.status !== 'confirmed' && admin
                    ? <UnlockRecordButton
                        onConfirm={() => qc.invalidateQueries({ queryKey: ['daily-input', adType, date] })}
                    />
                    : null
            )
        },
    ]

    const columns: ColumnsType<DailyInputRow> = withTableEllipsis([
        {
            title: '#',
            key: 'index',
            width: 50,
            render: (_: unknown, __: DailyInputRow, idx: number) => idx + 1,
        },
        ...middleColumns,
        {
            title: t('input.qtyUV'),
            key: 'qty',
            width: 100,
            align: 'right',
            render: (_: unknown, record: DailyInputRow) => {
                if (record.billing_method !== 'CPM') {
                    return <span className="text-muted">—</span>
                }
                const value = drafts[record.id]?.qty ?? record.existing_record?.qty ?? 0
                return (
                    <TableNumberInput
                        ref={(el) => { inputRefs.current[`qty-${record.id}`] = el }}
                        value={value}
                        onChange={(val) => updateDraft(record.id, { qty: val ?? undefined })}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                e.preventDefault()
                                inputRefs.current[`unit_price-${record.id}`]?.focus()
                            }
                        }}
                    />
                )
            },
        },
        {
            title: t('input.unitPrice'),
            key: 'unit_price',
            width: 100,
            align: 'right',
            render: (_: unknown, record: DailyInputRow) => {
                if (record.billing_method !== 'CPM') {
                    return <span className="text-muted">—</span>
                }
                const value =
                    drafts[record.id]?.unit_price ??
                    record.existing_record?.unit_price_snapshot ??
                    record.current_unit_price ??
                    0
                return (
                    <TableNumberInput
                        ref={(el) => { inputRefs.current[`unit_price-${record.id}`] = el }}
                        value={value}
                        onChange={(val) => updateDraft(record.id, { unit_price: val ?? undefined })}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowUp') {
                                e.preventDefault()
                                inputRefs.current[`qty-${record.id}`]?.focus()
                            }
                        }}
                    />
                )
            },
        },
        {
            title: t('input.amount1'),
            key: 'amount1',
            width: 100,
            align: 'right',
            render: (_: unknown, record: DailyInputRow) => {
                if (record.billing_method !== 'RATIO') {
                    return <span className="text-muted">—</span>
                }
                const value = drafts[record.id]?.amount1 ?? record.existing_record?.amount1 ?? 0
                return (
                    <TableNumberInput
                        ref={(el) => { inputRefs.current[`amount1-${record.id}`] = el }}
                        value={value}
                        onChange={(val) => updateDraft(record.id, { amount1: val ?? undefined })}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                e.preventDefault()
                                inputRefs.current[`amount2-${record.id}`]?.focus()
                            }
                        }}
                    />
                )
            },
        },
        {
            title: t('input.amount2'),
            key: 'amount2',
            width: 100,
            align: 'right',
            render: (_: unknown, record: DailyInputRow) => {
                if (record.billing_method !== 'RATIO') {
                    return <span className="text-muted">—</span>
                }
                const value = drafts[record.id]?.amount2 ?? record.existing_record?.amount2 ?? 0
                return (
                    <TableNumberInput
                        ref={(el) => { inputRefs.current[`amount2-${record.id}`] = el }}
                        value={value}
                        onChange={(val) => updateDraft(record.id, { amount2: val ?? undefined })}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowUp') {
                                e.preventDefault()
                                inputRefs.current[`amount1-${record.id}`]?.focus()
                            }
                            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                e.preventDefault()
                                inputRefs.current[`ratio-${record.id}`]?.focus()
                            }
                        }}
                    />
                )
            },
        },
        {
            title: t('input.ratio'),
            key: 'ratio',
            width: 80,
            align: 'right',
            render: (_: unknown, record: DailyInputRow) => {
                if (record.billing_method !== 'RATIO') {
                    return <span className="text-muted">—</span>
                }
                const value =
                    drafts[record.id]?.ratio_override ??
                    record.existing_record?.ratio_snapshot ??
                    record.current_ratio ??
                    1
                return (
                    <TableNumberInput
                        ref={(el) => { inputRefs.current[`ratio-${record.id}`] = el }}
                        value={value}
                        precision={4}
                        onChange={(val) => updateDraft(record.id, { ratio_override: val ?? undefined })}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowUp') {
                                e.preventDefault()
                                inputRefs.current[`amount2-${record.id}`]?.focus()
                            }
                        }}
                    />
                )
            },
        },
        {
            title: t('input.revenue'),
            key: 'revenue',
            width: 120,
            align: 'right',
            render: (_: unknown, record: DailyInputRow) => (
                <span className={isDirty(record) ? 'text-primary' : ''}>
                    {formatIsoMoney(getRevenue(record))}
                </span>
            ),
        },
        ...trailingColumns,
    ])

    const totalQty = rows.reduce((sum, row) => sum + (row.billing_method === 'CPM' ? (drafts[row.id]?.qty ?? row.existing_record?.qty ?? 0) : 0), 0)
    const totalRevenue = rows.reduce((sum, row) => sum + getRevenue(row), 0)
    const dirtyCount = Object.keys(drafts).length

    if (isError) {
        return <Alert type="error" message={t('input.loadFail')} />
    }

    if (isLoading) {
        return (
            <div className="loading-state">
                <Spin />
            </div>
        )
    }

    if (rows.length === 0) {
        return <Empty description={t('input.noData')} />
    }

    return (
        <div className="daily-input-table-wrapper">
            <div className="daily-input-table-actions">
                <ConfirmAllButton
                    disabled={unconfirmedIds.length === 0 || !canConfirm}
                    loading={confirmAllMutation.isPending}
                    onConfirm={() => confirmAllMutation.mutateAsync(unconfirmedIds)}
                />
                <Button size="small" onClick={() => {
                    Object.keys(drafts).forEach((id) => {
                        const input1 = inputRefs.current[`qty-${id}`]
                        const input2 = inputRefs.current[`unit_price-${id}`]
                        const input3 = inputRefs.current[`amount1-${id}`]
                        const input4 = inputRefs.current[`amount2-${id}`]
                        const input5 = inputRefs.current[`ratio-${id}`]
                            ;[input1, input2, input3, input4, input5].forEach((inp) => inp?.blur())
                    })
                }}>
                    {t('input.clearAll')}
                </Button>
            </div>
            <Table
                className="app-data-table daily-input-table"
                data-testid="daily-input-table"
                columns={columns}
                dataSource={rows}
                rowKey="id"
                size="small"
                bordered
                pagination={false}
                rowClassName={rowClassName}
                summary={() => (
                    <Table.Summary fixed="bottom">
                        <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={qtyColumnIndex}>
                                <strong>{t('input.total')}</strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={qtyColumnIndex}>
                                <strong>{formatIsoInteger(totalQty)}</strong>
                            </Table.Summary.Cell>
                            {middleColumns.map((_column, offset) => (
                                <Table.Summary.Cell key={offset} index={qtyColumnIndex + 1 + offset} />
                            ))}
                            <Table.Summary.Cell index={revenueColumnIndex}>
                                <strong>{formatIsoMoney(totalRevenue)}</strong>
                            </Table.Summary.Cell>
                            {trailingColumns.map((_column, offset) => (
                                <Table.Summary.Cell key={offset} index={revenueColumnIndex + 1 + offset} />
                            ))}
                        </Table.Summary.Row>
                    </Table.Summary>
                )}
            />
            <SaveBar
                dirtyCount={dirtyCount}
                loading={mutation.isPending}
                onSave={handleSave}
            />
        </div>
    )
}