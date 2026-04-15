import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, InputNumber, Result, Spin, Table, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'
import api from '../api/axios'
import type { ApiResponse } from '../types'
import { formatIsoInteger, formatIsoMoney } from '../utils/numberFormat'

const CHANNELS = ['yy-02-01', 'yy-02-02', 'yy-02-03', 'yy-02-04'] as const
const DEFAULT_UNIT_PRICE = 2
const DEFAULT_PROFIT_UNIT_PRICE = 1

type ChannelCode = (typeof CHANNELS)[number]

type MonthlyApiRow = {
  date: string
  unit_price: number
  profit_unit_price: number
} & Record<ChannelCode, number>

type DraftRow = {
  unit_price: number
  profit_unit_price: number
} & Record<ChannelCode, number>

type DraftMap = Record<string, DraftRow>

type TableRow = {
  key: string
  date: string
  isSummary?: boolean
}

const EMPTY_MONTHLY_ROWS: MonthlyApiRow[] = []

function createEmptyDraftRow(): DraftRow {
  return {
    unit_price: DEFAULT_UNIT_PRICE,
    profit_unit_price: DEFAULT_PROFIT_UNIT_PRICE,
    'yy-02-01': 0,
    'yy-02-02': 0,
    'yy-02-03': 0,
    'yy-02-04': 0,
  }
}

function formatMoney(value: number): string {
  return formatIsoMoney(value)
}

function formatQty(value: number): string {
  return formatIsoInteger(value)
}

export default function YiyiInputPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs())
  const [drafts, setDrafts] = useState<DraftMap>({})

  const year = selectedMonth.year()
  const month = selectedMonth.month() + 1

  const { data, isLoading, error } = useQuery<MonthlyApiRow[]>({
    queryKey: ['yiyi-data', 'monthly', year, month],
    queryFn: async () => {
      const res = await api.get<ApiResponse<MonthlyApiRow[]>>('/api/yiyi-data/monthly', {
        params: { year, month },
      })
      return res.data.data ?? []
    },
  })
  const monthlyRows = data ?? EMPTY_MONTHLY_ROWS

  useEffect(() => {
    const nextDrafts: DraftMap = {}

    for (const row of monthlyRows) {
      nextDrafts[row.date] = {
        unit_price: row.unit_price ?? DEFAULT_UNIT_PRICE,
        profit_unit_price: row.profit_unit_price ?? DEFAULT_PROFIT_UNIT_PRICE,
        'yy-02-01': row['yy-02-01'] ?? 0,
        'yy-02-02': row['yy-02-02'] ?? 0,
        'yy-02-03': row['yy-02-03'] ?? 0,
        'yy-02-04': row['yy-02-04'] ?? 0,
      }
    }

    setDrafts(nextDrafts)
  }, [data])

  const mutation = useMutation({
    mutationFn: async (payload: { rows: MonthlyApiRow[] }) => {
      const res = await api.post('/api/yiyi-data/monthly-batch', payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['yiyi-data', 'monthly', year, month] })
      message.success(t('yiyi.saveSuccess'))
    },
    onError: () => {
      message.error(t('yiyi.saveFail'))
    },
  })

  const monthRows = monthlyRows.map((row) => ({
    key: row.date,
    date: row.date,
  }))
  const monthDates = monthRows.map((row) => row.date)

  const getDraftRow = (date: string): DraftRow => drafts[date] ?? createEmptyDraftRow()
  const getChannelValue = (date: string, channel: ChannelCode): number => getDraftRow(date)[channel] ?? 0
  const getUnitPrice = (date: string): number => getDraftRow(date).unit_price ?? DEFAULT_UNIT_PRICE
  const getProfitUnitPrice = (date: string): number => getDraftRow(date).profit_unit_price ?? DEFAULT_PROFIT_UNIT_PRICE
  const getRowQty = (date: string): number => CHANNELS.reduce((sum, channel) => sum + getChannelValue(date, channel), 0)
  const getRowAmount = (date: string): number => (getRowQty(date) * getUnitPrice(date)) / 1000
  const getRowProfit = (date: string): number => (getRowQty(date) * getProfitUnitPrice(date)) / 1000
  const getRowTotal = (date: string): number => getRowAmount(date) + getRowProfit(date)

  const summaryChannels = CHANNELS.reduce<Record<ChannelCode, number>>((acc, channel) => {
    acc[channel] = monthRows.reduce((sum, row) => sum + getChannelValue(row.date, channel), 0)
    return acc
  }, {
    'yy-02-01': 0,
    'yy-02-02': 0,
    'yy-02-03': 0,
    'yy-02-04': 0,
  })

  const summaryQty = monthRows.reduce((sum, row) => sum + getRowQty(row.date), 0)
  const summaryAmount = monthRows.reduce((sum, row) => sum + getRowAmount(row.date), 0)
  const summaryProfit = monthRows.reduce((sum, row) => sum + getRowProfit(row.date), 0)
  const summaryTotal = summaryAmount + summaryProfit

  const displayRows: TableRow[] = [
    { key: 'summary', date: t('yiyi.summary'), isSummary: true },
    ...monthRows,
  ]

  const handleChannelChange = (date: string, channel: ChannelCode, value: number | null) => {
    setDrafts((prev) => ({
      ...prev,
      [date]: {
        ...createEmptyDraftRow(),
        ...prev[date],
        [channel]: value ?? 0,
      },
    }))
  }

  const handlePriceChange = (date: string, field: 'unit_price' | 'profit_unit_price', value: number | null) => {
    const nextValue = value ?? (field === 'unit_price' ? DEFAULT_UNIT_PRICE : DEFAULT_PROFIT_UNIT_PRICE)

    setDrafts((prev) => {
      const nextDrafts = { ...prev }
      let shouldApply = false

      for (const currentDate of monthDates) {
        if (currentDate === date) {
          shouldApply = true
        }

        if (!shouldApply) continue

        nextDrafts[currentDate] = {
          ...createEmptyDraftRow(),
          ...nextDrafts[currentDate],
          [field]: nextValue,
        }
      }

      return nextDrafts
    })
  }

  const handleSave = () => {
    const rows: MonthlyApiRow[] = monthRows.map((row) => ({
      date: row.date,
      unit_price: getUnitPrice(row.date),
      profit_unit_price: getProfitUnitPrice(row.date),
      'yy-02-01': getChannelValue(row.date, 'yy-02-01'),
      'yy-02-02': getChannelValue(row.date, 'yy-02-02'),
      'yy-02-03': getChannelValue(row.date, 'yy-02-03'),
      'yy-02-04': getChannelValue(row.date, 'yy-02-04'),
    }))

    mutation.mutate({ rows })
  }

  const columns: ColumnsType<TableRow> = [
    {
      title: t('yiyi.vendorPay'),
      children: [
        {
          title: t('yiyi.date'),
          dataIndex: 'date',
          key: 'date',
          width: 120,
          fixed: 'left',
          render: (_: string, row) => (row.isSummary ? <strong>{t('yiyi.summary')}</strong> : <span>{row.date}</span>),
        },
        {
          title: t('yiyi.qty'),
          key: 'qty',
          width: 110,
          render: (_: unknown, row) => {
            const value = row.isSummary ? summaryQty : getRowQty(row.date)
            return row.isSummary ? <strong>{formatQty(value)}</strong> : formatQty(value)
          },
        },
        {
          title: t('yiyi.unitPrice'),
          key: 'unit_price',
          width: 120,
          render: (_: unknown, row) => {
            if (row.isSummary) return <strong>-</strong>

            return (
              <InputNumber
                min={0}
                precision={4}
                controls={false}
                style={{ width: '100%' }}
                value={getUnitPrice(row.date)}
                onChange={(value) => handlePriceChange(row.date, 'unit_price', value)}
              />
            )
          },
        },
        {
          title: t('yiyi.amount'),
          key: 'amount',
          width: 120,
          render: (_: unknown, row) => {
            const value = row.isSummary ? summaryAmount : getRowAmount(row.date)
            return row.isSummary ? <strong>{formatMoney(value)}</strong> : formatMoney(value)
          },
        },
      ],
    },
    ...CHANNELS.map((channel) => ({
      title: channel,
      dataIndex: channel,
      key: channel,
      width: 130,
      render: (_: unknown, row: TableRow) => {
        if (row.isSummary) {
          return <strong>{formatQty(summaryChannels[channel])}</strong>
        }

        return (
          <InputNumber
            min={0}
            precision={0}
            controls={false}
            style={{ width: '100%' }}
            value={getChannelValue(row.date, channel)}
            onChange={(value) => handleChannelChange(row.date, channel, value)}
          />
        )
      },
    })),
    {
      title: t('yiyi.profitUnitPrice'),
      key: 'profit_unit_price',
      width: 130,
      render: (_: unknown, row) => {
        if (row.isSummary) return <strong>-</strong>

        return (
          <InputNumber
            min={0}
            precision={4}
            controls={false}
            style={{ width: '100%' }}
            value={getProfitUnitPrice(row.date)}
            onChange={(value) => handlePriceChange(row.date, 'profit_unit_price', value)}
          />
        )
      },
    },
    {
      title: t('yiyi.profit'),
      key: 'profit',
      width: 110,
      render: (_: unknown, row) => {
        const value = row.isSummary ? summaryProfit : getRowProfit(row.date)
        return row.isSummary ? <strong>{formatMoney(value)}</strong> : formatMoney(value)
      },
    },
    {
      title: t('yiyi.total'),
      key: 'total',
      width: 120,
      render: (_: unknown, row) => {
        const value = row.isSummary ? summaryTotal : getRowTotal(row.date)
        return row.isSummary ? <strong>{formatMoney(value)}</strong> : formatMoney(value)
      },
    },
  ]

  if (isLoading) {
    return (
      <div style={{ padding: 50, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return <Result status="error" title={t('yiyi.loadError')} />
  }

  return (
    <div className="page-shell">
      <div className="page-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DatePicker.MonthPicker
            value={selectedMonth}
            format="YYYY-MM"
            allowClear={false}
            onChange={(value) => {
              if (value) setSelectedMonth(value)
            }}
          />
          <span className="page-subtitle">{t('yiyi.title')}</span>
        </div>

      </div>

      <div className="dashboard-table-shell">
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Typography.Text type="secondary">
            {t('yiyi.formula')}
          </Typography.Text>
        </div>

      <Table<TableRow>
        columns={columns}
        dataSource={displayRows}
        rowKey="key"
        bordered
        pagination={false}
        size="small"
        className="dashboard-total-table dashboard-total-table--with-bottom-scroll"
        scroll={{ x: 'max-content' }}
        sticky={{ offsetHeader: 64 }}
        rowClassName={(row) => (row.isSummary ? 'dashboard-total-summary-row row-total' : '')}
      />

      <Button
        type="primary"
        style={{ marginTop: 20, minWidth: 180 }}
        loading={mutation.isPending}
        onClick={handleSave}
      >
        {t('yiyi.saveMonth')}
      </Button>
      </div>
    </div>
  )
}
