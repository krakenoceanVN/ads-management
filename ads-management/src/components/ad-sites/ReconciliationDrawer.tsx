import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Card, Col, DatePicker, Drawer, InputNumber, Result, Row, Spin, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'
import api from '../../api/axios'
import type { ApiResponse } from '../../types'
import { formatIsoInteger, formatIsoMoney } from '../../utils/numberFormat'

interface ReconciliationDrawerProps {
  open: boolean
  siteId?: number
  siteName?: string
  onClose: () => void
}

interface ReconciliationResponse {
  siteInfo: {
    id: number
    name: string
  }
  range: {
    startDate: string
    endDate: string
  }
  summary: {
    totalQty: number
    totalRevenue: number
    totalActualQty: number
    totalActualRevenue: number
  }
  dailyDetails: Array<{
    date: string
    qty: number
    revenue: number
    actualRevenue: number
  }>
}

interface DailyDetailRow {
  key: string
  date: string
  qty: number
  revenue: number
  actualRevenue: number
}

export default function ReconciliationDrawer({
  open,
  siteId,
  siteName,
  onClose,
}: ReconciliationDrawerProps) {
  const { t } = useTranslation()
  const [selectedRange, setSelectedRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [partnerReportedRevenue, setPartnerReportedRevenue] = useState<number | null>(null)
  const [partnerReportedQty, setPartnerReportedQty] = useState<number | null>(null)

  const [startDate, endDate] = selectedRange
  const startDateStr = startDate.format('YYYY-MM-DD')
  const endDateStr = endDate.format('YYYY-MM-DD')

  const { data, isLoading, error } = useQuery<ReconciliationResponse>({
    queryKey: ['ad-site-reconciliation', siteId, startDateStr, endDateStr],
    enabled: open && Boolean(siteId),
    queryFn: async () => {
      const res = await api.get<ApiResponse<ReconciliationResponse>>(`/api/admin/ad-sites/${siteId}/reconciliation`, {
        params: {
          start_date: startDateStr,
          end_date: endDateStr,
        },
      })
      return res.data.data as ReconciliationResponse
    },
  })

  const systemRevenue = useMemo(() => {
    if (!data) return 0
    return data.summary.totalActualRevenue > 0
      ? data.summary.totalActualRevenue
      : data.summary.totalRevenue
  }, [data])

  const systemQty = useMemo(() => {
    if (!data) return 0
    return data.summary.totalActualQty > 0
      ? data.summary.totalActualQty
      : data.summary.totalQty
  }, [data])

  const revenueDifference = (partnerReportedRevenue ?? 0) - systemRevenue
  const revenueDifferenceColor = revenueDifference < 0 ? '#dc2626' : revenueDifference > 0 ? '#16a34a' : '#111827'
  const qtyDifference = (partnerReportedQty ?? 0) - systemQty
  const qtyDifferenceColor = qtyDifference < 0 ? '#dc2626' : qtyDifference > 0 ? '#16a34a' : '#111827'

  const rows: DailyDetailRow[] = (data?.dailyDetails ?? []).map((item) => ({
    key: item.date,
    date: item.date,
    qty: item.qty,
    revenue: item.revenue,
    actualRevenue: item.actualRevenue,
  }))

  const columns: ColumnsType<DailyDetailRow> = [
    {
      title: t('reconciliation.day'),
      dataIndex: 'date',
      key: 'date',
      width: 140,
    },
    {
      title: t('reconciliation.systemQty'),
      dataIndex: 'qty',
      key: 'qty',
      width: 140,
      render: (value: number) => formatIsoInteger(value),
    },
    {
      title: t('reconciliation.systemRevenue'),
      key: 'system_revenue',
      width: 180,
      render: (_value: unknown, row) => formatIsoMoney(row.actualRevenue > 0 ? row.actualRevenue : row.revenue),
    },
  ]

  return (
    <Drawer
      title={t('reconciliation.title', { name: siteName ?? data?.siteInfo.name ?? `#${siteId ?? ''}` })}
      placement="right"
      width={960}
      open={open}
      onClose={onClose}
      destroyOnClose={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 600 }}>{t('reconciliation.range')}</span>
          <DatePicker.RangePicker
            value={selectedRange}
            allowClear={false}
            format="YYYY-MM-DD"
            onChange={(value) => {
              if (value?.[0] && value?.[1]) {
                setSelectedRange([value[0], value[1]])
              }
            }}
          />
        </div>

        {isLoading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Spin size="large" />
          </div>
        ) : error ? (
          <Result status="error" title={t('reconciliation.loadError')} />
        ) : (
          <>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Card>
                  <Typography.Text type="secondary">{t('reconciliation.totalSystemRevenue')}</Typography.Text>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700 }}>
                    {formatIsoMoney(systemRevenue)}
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card>
                  <Typography.Text type="secondary">{t('reconciliation.partnerReportedRevenue')}</Typography.Text>
                  <div style={{ marginTop: 12 }}>
                    <InputNumber
                      min={0}
                      controls={false}
                      style={{ width: '100%' }}
                      value={partnerReportedRevenue}
                      onChange={(value) => setPartnerReportedRevenue(typeof value === 'number' ? value : null)}
                    />
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card>
                  <Typography.Text type="secondary">{t('reconciliation.revenueDifference')}</Typography.Text>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: revenueDifferenceColor }}>
                    {formatIsoMoney(revenueDifference)}
                  </div>
                </Card>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Card>
                  <Typography.Text type="secondary">{t('reconciliation.totalSystemQty')}</Typography.Text>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700 }}>
                    {formatIsoInteger(systemQty)}
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card>
                  <Typography.Text type="secondary">{t('reconciliation.partnerReportedQty')}</Typography.Text>
                  <div style={{ marginTop: 12 }}>
                    <InputNumber
                      min={0}
                      controls={false}
                      precision={0}
                      style={{ width: '100%' }}
                      value={partnerReportedQty}
                      onChange={(value) => setPartnerReportedQty(typeof value === 'number' ? value : null)}
                    />
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card>
                  <Typography.Text type="secondary">{t('reconciliation.qtyDifference')}</Typography.Text>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: qtyDifferenceColor }}>
                    {formatIsoInteger(qtyDifference)}
                  </div>
                </Card>
              </Col>
            </Row>

            <Table<DailyDetailRow>
              rowKey="key"
              className="app-data-table"
              bordered
              pagination={false}
              columns={columns}
              dataSource={rows}
              size="small"
              scroll={{ x: 320, y: 480 }}
            />
          </>
        )}
      </div>
    </Drawer>
  )
}
