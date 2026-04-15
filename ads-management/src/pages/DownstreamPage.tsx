import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Table } from 'antd'
import { Link } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import api from '../api/axios'
import type { ApiResponse } from '../types'
import { formatIsoPercent } from '../utils/numberFormat'

interface DownstreamRow {
  id: number
  ad_type_id: number
  ad_type_code: string
  downstream_type: string
  payout_rate: number
  status: 'active' | 'inactive'
}

interface AdSiteRow {
  id: number
  ad_site_name: string
  upstream_name: string
  billing_method: string
  downstream_ids: number[]
}

export default function DownstreamPage() {
  const { t } = useTranslation()
  const { data: downstreams = [], isLoading: dsLoading } = useQuery({
    queryKey: ['admin', 'downstreams'],
    queryFn: () => api.get<ApiResponse<DownstreamRow[]>>('/api/admin/downstreams').then((r) => r.data.data ?? []),
  })

  const { data: adSites = [] } = useQuery({
    queryKey: ['admin', 'ad-sites'],
    queryFn: () => api.get<ApiResponse<AdSiteRow[]>>('/api/admin/ad-sites').then((r) => r.data.data ?? []),
  })

  const downstreamColumns: ColumnsType<DownstreamRow> = [
    { title: t('downstream.adType'), dataIndex: 'ad_type_code', key: 'ad_type_code', width: 100 },
    { title: t('downstream.type'), dataIndex: 'downstream_type', key: 'downstream_type', width: 100 },
    {
      title: t('downstream.payoutRate'),
      dataIndex: 'payout_rate',
      key: 'payout_rate',
      width: 120,
      render: (v: number) => formatIsoPercent(v),
    },
    {
      title: t('downstream.adSites'),
      key: 'ad_sites',
      width: 80,
      render: (_: unknown, row: DownstreamRow) => {
        const count = adSites.filter((s) => s.downstream_ids?.includes(row.id)).length
        if (count === 0) return '-'
        return <Link to={`/downstream/${row.id}`}>{t('downstream.siteCount', { count })}</Link>
      },
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>{t('downstream.pageTitle')}</h2>
      <Table
        columns={downstreamColumns}
        dataSource={downstreams}
        rowKey="id"
        size="small"
        bordered
        loading={dsLoading}
        pagination={false}
      />
    </div>
  )
}
