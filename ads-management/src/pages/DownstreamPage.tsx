import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Alert, Table } from 'antd'
import { Link } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import api from '../api/axios'
import type { ApiResponse } from '../types'
import { withTableEllipsis } from '../utils/tableEllipsis'
import { formatIsoPercent } from '../utils/numberFormat'

interface DownstreamRow {
  id: number
  ad_type_id: number
  ad_type_code: string
  downstream_type: string
  payout_rate: number
  site_count: number
  status: 'active' | 'inactive'
}

export default function DownstreamPage() {
  const { t } = useTranslation()
  const { data: downstreams = [], isLoading: dsLoading, isError: dsError } = useQuery({
    queryKey: ['admin', 'downstreams'],
    queryFn: () => api.get<ApiResponse<DownstreamRow[]>>('/api/admin/downstreams').then((r) => r.data.data ?? []),
  })

  const downstreamColumns: ColumnsType<DownstreamRow> = withTableEllipsis([
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
        const count = row.site_count ?? 0
        if (count === 0) return '-'
        return <Link to={`/downstream/${row.id}`}>{t('downstream.siteCount', { count })}</Link>
      },
    },
  ])

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>{t('downstream.pageTitle')}</h2>
      {dsError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('downstream.loadError')}
        />
      )}
      <Table
        className="app-data-table"
        columns={downstreamColumns}
        dataSource={downstreams}
        rowKey="id"
        size="small"
        bordered
        loading={dsLoading}
        pagination={false}
        tableLayout="fixed"
        locale={{ emptyText: dsError ? t('downstream.loadError') : undefined }}
      />
    </div>
  )
}
