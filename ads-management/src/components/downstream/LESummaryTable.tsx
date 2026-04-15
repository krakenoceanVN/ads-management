import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, DatePicker, InputNumber, Button, message, Spin } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'
import html2pdf from 'html2pdf.js'
import api from '../../api/axios'

interface DailyRow {
  date: string
  smRevenue: number
  leRevenue: number
  cost: number
  tax: number
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

export default function LESummaryTable({ month, onMonthChange }: Props) {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['le-dashboard', month.format('YYYY-MM')],
    queryFn: async () => {
      const res = await api.get<ApiResponse>('/api/dashboard/le', {
        params: { month: month.format('YYYY-MM') },
      })
      return res.data
    },
  })

  const saveCostMutation = useMutation({
    mutationFn: async ({ date, costAmount }: { date: string; costAmount: number }) => {
      const res = await api.post('/api/dashboard/le/cost', { date, costAmount })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['le-dashboard', month.format('YYYY-MM')] })
      message.success('Đã lưu chi phí LE')
    },
    onError: () => {
      message.error('Lỗi khi lưu chi phí LE')
    },
  })

  const handleCostChange = useCallback((date: string, value: number | null) => {
    saveCostMutation.mutate({ date, costAmount: value ?? 0 })
  }, [saveCostMutation])

  const upstreamNames = data?.data?.upstreamNames ?? []
  const rows = data?.data?.rows ?? []

  const exportPDF = () => {
    if (rows.length === 0) return

    const monthStr = month.format('YYYY-MM')
    const [year, monthNumber] = monthStr.split('-')
    const pageMargin = 6
    const dateColWidth = 100
    const smRevenueColWidth = 130
    const leRevenueColWidth = 140
    const taxColWidth = 120
    const costColWidth = 150
    const profitColWidth = 130
    const rateColWidth = 100
    const upstreamColWidth = 110
    const contentWidthPx = dateColWidth
      + smRevenueColWidth
      + leRevenueColWidth
      + taxColWidth
      + costColWidth
      + profitColWidth
      + rateColWidth
      + (upstreamNames.length * upstreamColWidth)
    const renderGutterPx = 120
    const tableWidthPx = contentWidthPx + renderGutterPx
    const pageWidthPx = tableWidthPx + (pageMargin * 2) + 24
    const pageHeightPx = Math.max(1200, 220 + ((rows.length + 2) * 28))

    const pdfHTML = `
      <div style="font-family: 'Arial', sans-serif; padding: 12px 48px 12px 12px; background: #fff; width: ${tableWidthPx}px; min-width: ${tableWidthPx}px; box-sizing: border-box;">
        <style>
          .le-report-table {
            width: ${contentWidthPx}px;
            min-width: ${contentWidthPx}px;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 9px;
          }
          .le-report-table thead {
            display: table-header-group;
          }
          .le-report-table th,
          .le-report-table td {
            vertical-align: middle;
            white-space: nowrap;
          }
          .le-report-table th.col-upstream {
            white-space: normal;
            word-break: break-word;
            line-height: 1.2;
          }
          .le-report-table th.col-date,
          .le-report-table td.col-date {
            width: ${dateColWidth}px;
          }
          .le-report-table th.col-sm,
          .le-report-table td.col-sm {
            width: ${smRevenueColWidth}px;
          }
          .le-report-table th.col-le,
          .le-report-table td.col-le {
            width: ${leRevenueColWidth}px;
          }
          .le-report-table th.col-tax,
          .le-report-table td.col-tax {
            width: ${taxColWidth}px;
          }
          .le-report-table th.col-cost,
          .le-report-table td.col-cost {
            width: ${costColWidth}px;
          }
          .le-report-table th.col-profit,
          .le-report-table td.col-profit {
            width: ${profitColWidth}px;
          }
          .le-report-table th.col-rate,
          .le-report-table td.col-rate {
            width: ${rateColWidth}px;
          }
          .le-report-table th.col-upstream,
          .le-report-table td.col-upstream {
            width: ${upstreamColWidth}px;
          }
        </style>
        <h2 style="text-align: center; margin: 0 0 4px 0; font-size: 16px; color: #222;">
          BÁO CÁO CHI TIẾT HẠ NGUỒN LE - SM (${monthStr})
        </h2>
        <p style="text-align: center; margin: 0 0 12px 0; color: #666; font-size: 11px;">
          Tháng ${monthNumber}/${year}
        </p>
        <table class="le-report-table">
          <thead>
            <tr style="background: #d9d9d9;">
              <th class="col-date" style="border: 1px solid #999; padding: 6px 4px; text-align: center; font-weight: bold; color: #333;">Ngày</th>
              <th class="col-sm" style="border: 1px solid #999; padding: 6px 4px; text-align: right; font-weight: bold; color: #333;">SM 收入</th>
              <th class="col-le" style="border: 1px solid #999; padding: 6px 4px; text-align: right; font-weight: bold; color: #333;">LE 90% 收入</th>
              <th class="col-tax" style="border: 1px solid #999; padding: 6px 4px; text-align: right; font-weight: bold; color: #333;">税额 (6%)</th>
              <th class="col-cost" style="border: 1px solid #999; padding: 6px 4px; text-align: right; font-weight: bold; color: #333;">支出 (Chi phí)</th>
              <th class="col-profit" style="border: 1px solid #999; padding: 6px 4px; text-align: right; font-weight: bold; color: #333;">利润</th>
              <th class="col-rate" style="border: 1px solid #999; padding: 6px 4px; text-align: right; font-weight: bold; color: #333;">利润率</th>
              ${upstreamNames.map((name) => `
                <th class="col-upstream" style="border: 1px solid #999; padding: 6px 4px; text-align: right; font-weight: bold; color: #333;">${name}</th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, idx) => `
              <tr style="background: ${row.isTotal ? '#e8f4e8' : idx % 2 === 0 ? '#fff' : '#f5f5f5'}; ${row.isTotal ? 'font-weight: bold;' : ''}">
                <td class="col-date" style="border: 1px solid #ccc; padding: 5px 4px; text-align: center; ${row.isTotal ? 'font-weight: 700;' : 'font-weight: 600;'}">${row.date === 'TOTAL' ? 'TỔNG CỘNG' : row.date}</td>
                <td class="col-sm" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right;">${row.smRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="col-le" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right; color: #2563eb; font-weight: 600;">${row.leRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="col-tax" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right;">${row.tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="col-cost" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right;">${row.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="col-profit" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right; color: ${row.profit >= 0 ? '#15803d' : '#dc2626'}; font-weight: 600;">${row.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="col-rate" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right; color: ${row.profitRate >= 0 ? '#15803d' : '#dc2626'};">${(row.profitRate * 100).toFixed(2)}%</td>
                ${upstreamNames.map((name) => `
                  <td class="col-upstream" style="border: 1px solid #ccc; padding: 5px 4px; text-align: right; color: #555;">
                    ${(row.upstreamBreakdown?.[name] ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p style="margin-top: 10px; font-size: 10px; color: #aaa; text-align: right;">
          Xuất ngày ${new Date().toLocaleDateString('vi-VN')} | Ad Management System
        </p>
      </div>
    `

    const opt = {
      margin: pageMargin,
      filename: `Bao-cao-LE-SM-${monthStr}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        width: tableWidthPx,
        windowWidth: tableWidthPx + 32,
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

    const exporter = html2pdf() as any
    exporter.set(opt).from(pdfHTML, 'string').save()
  }

  const baseColumns: ColumnsType<DailyRow> = [
    {
      title: 'Ngày',
      dataIndex: 'date',
      key: 'date',
      width: 100,
      fixed: 'left',
      render: (val: string) => val === 'TOTAL'
        ? <strong style={{ color: 'var(--color-primary)' }}>TỔNG CỘNG</strong>
        : val,
    },
    {
      title: 'SM 收入',
      dataIndex: 'smRevenue',
      key: 'smRevenue',
      width: 130,
      render: (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2 }),
    },
    {
      title: 'LE 90% 收入',
      dataIndex: 'leRevenue',
      key: 'leRevenue',
      width: 140,
      render: (val: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-primary)', fontWeight: 600 }}>
          {val.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: '税额 (6%)',
      dataIndex: 'tax',
      key: 'tax',
      width: 120,
      render: (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2 }),
    },
    {
      title: '支出 (Chi phí)',
      dataIndex: 'cost',
      key: 'cost',
      width: 150,
      render: (val: number, record) => {
        if (record.isTotal) {
          return (
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-danger)' }}>
              {val.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          )
        }
        return (
          <InputNumber
            size="small"
            min={0}
            precision={2}
            value={val}
            onChange={(v) => handleCostChange(record.date, v)}
            controls={false}
            style={{ width: '100%' }}
            prefix="¥"
          />
        )
      },
    },
    {
      title: '利润',
      dataIndex: 'profit',
      key: 'profit',
      width: 130,
      render: (val: number) => (
        <span style={{
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
          color: val >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
        }}>
          {val.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: '利润率',
      dataIndex: 'profitRate',
      key: 'profitRate',
      width: 100,
      render: (val: number) => (
        <span style={{
          fontVariantNumeric: 'tabular-nums',
          color: val >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
        }}>
          {(val * 100).toFixed(2)}%
        </span>
      ),
    },
  ]

  const upstreamColumns: ColumnsType<DailyRow> = upstreamNames.map((name) => ({
    title: name,
    dataIndex: ['upstreamBreakdown', name],
    key: name,
    width: 110,
    render: (val: number) => (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {val != null ? val.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
      </span>
    ),
  }))

  const columns: ColumnsType<DailyRow> = [...baseColumns, ...upstreamColumns]

  if (isLoading) {
    return (
      <div style={{ padding: 50, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <DatePicker
          picker="month"
          value={month ? dayjs(month.format('YYYY-MM'), 'YYYY-MM') : dayjs()}
          format="YYYY-MM"
          onChange={(_, dateString) => {
            if (dateString) {
              onMonthChange(dayjs(typeof dateString === 'string' ? dateString : dateString[0]))
            }
          }}
          allowClear={false}
        />
        <Button type="primary" icon={<DownloadOutlined />} onClick={exportPDF}>
          Xuất PDF (LE)
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={rows}
        rowKey="date"
        size="small"
        bordered
        scroll={{ x: 800 + upstreamNames.length * 110 }}
        pagination={false}
        rowClassName={(record) => (record.isTotal ? 'row-total' : '')}
      />
    </div>
  )
}
