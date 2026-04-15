import { useQuery } from '@tanstack/react-query'
import { Table } from 'antd'
import { Link } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import api from '../api/axios'
import type { ApiResponse } from '../types'

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
  const { data: downstreams = [], isLoading: dsLoading } = useQuery({
    queryKey: ['admin', 'downstreams'],
    queryFn: () => api.get<ApiResponse<DownstreamRow[]>>('/api/admin/downstreams').then((r) => r.data.data ?? []),
  })

  const { data: adSites = [] } = useQuery({
    queryKey: ['admin', 'ad-sites'],
    queryFn: () => api.get<ApiResponse<AdSiteRow[]>>('/api/admin/ad-sites').then((r) => r.data.data ?? []),
  })

  const downstreamColumns: ColumnsType<DownstreamRow> = [
    { title: 'Ad Type', dataIndex: 'ad_type_code', key: 'ad_type_code', width: 100 },
    { title: 'Type', dataIndex: 'downstream_type', key: 'downstream_type', width: 100 },
    {
      title: 'Payout Rate',
      dataIndex: 'payout_rate',
      key: 'payout_rate',
      width: 120,
      render: (v: number) => `${(v * 100).toFixed(0)}%`,
    },
    {
      title: 'Ad Sites',
      key: 'ad_sites',
      width: 80,
      render: (_: unknown, row: DownstreamRow) => {
        const count = adSites.filter((s) => s.downstream_ids?.includes(row.id)).length
        if (count === 0) return '-'
        return <Link to={`/downstream/${row.id}`}>{count} sites</Link>
      },
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Hạ nguồn (Downstream)</h2>
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