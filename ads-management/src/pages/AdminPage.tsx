import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tabs, Table, Button, Modal, Form, Input, InputNumber,
  Select, Drawer, DatePicker, Space, Tag, message, Popconfirm,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import api from '../api/axios'
import type { ApiResponse } from '../types'
import { withTableEllipsis } from '../utils/tableEllipsis'
import { formatIsoFixed, formatIsoNumber, formatIsoPercent } from '../utils/numberFormat'

// ============================================================
// Shared types
// ============================================================
interface AdSiteRow {
  id: number
  ad_type_code: string
  upstream_name: string
  ad_site_name: string
  billing_method: 'CPM' | 'RATIO'
  current_unit_price?: number
  current_ratio?: number
  status: 'active' | 'inactive'
  downstream_ids?: number[]
  downstream_prices?: Record<string, number>
}

interface AdSiteFormValues {
  name: string
  upstream_id: number
  billing_method: 'CPM' | 'RATIO'
  current_unit_price?: number
  current_ratio?: number
  status: 'active' | 'inactive'
  downstream_ids?: number[]
}

interface UpstreamRow {
  id: number
  ad_type_id: number
  ad_type_code: string
  ad_type_name: string
  name: string
  status: 'active' | 'inactive'
}

interface UpstreamFormValues {
  name: string
  ad_type_id: number
  status: 'active' | 'inactive'
}

interface DownstreamRow {
  id: number
  ad_type_code: string
  downstream_type: string
  payout_rate: number
  status: 'active' | 'inactive'
}

interface DownstreamFormValues {
  ad_type_id: number
  downstream_type: 'ML' | 'LE' | 'YIYI'
  payout_rate: number
  status: 'active' | 'inactive'
}

interface DownstreamPeriodRow {
  id: number
  downstream_id: number
  downstream_type: string
  ad_type_code: string
  pct_hal: number
  unit_price?: number
  start_date: string
  end_date?: string
  note?: string
}

interface UserRow {
  id: number
  username: string
  perm_data_input: boolean
  perm_data_confirm: boolean
  perm_admin: boolean
  status: 'active' | 'inactive'
  created_at: string
}

interface UserFormValues {
  username?: string
  password?: string
  perm_data_input: boolean
  perm_data_confirm: boolean
  perm_admin: boolean
  status: 'active' | 'inactive'
}

interface CreateUserPayload {
  username: string
  password: string
  perm_data_input: number
  perm_data_confirm: number
  perm_admin: number
  status: 'active' | 'inactive'
}

function matchesAdminSearch(search: string, values: unknown[]): boolean {
  const keyword = search.trim().toLowerCase()

  if (!keyword) return true

  return values.some((value) => String(value ?? '').toLowerCase().includes(keyword))
}

function formatPriceValue(value: number): string {
  return formatIsoNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 4 })
}

// ============================================================
// Tab 1: Ad Sites
// ============================================================
function AdSitesTab() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<Partial<AdSiteFormValues> & { id?: number } | null>(null)
  const [priceModal, setPriceModal] = useState<AdSiteRow | null>(null)
  const [downstreamPriceModal, setDownstreamPriceModal] = useState<AdSiteRow | null>(null)
  const [siteForm] = Form.useForm()
  const [priceForm] = Form.useForm()
  const [downstreamPriceForm] = Form.useForm()
  const qc = useQueryClient()

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['admin', 'ad-sites'],
    queryFn: () => api.get<ApiResponse<AdSiteRow[]>>('/api/admin/ad-sites').then((r) => r.data.data ?? []),
  })

  const { data: upstreams = [] } = useQuery({
    queryKey: ['admin', 'upstreams'],
    queryFn: () =>
      api.get<ApiResponse<UpstreamRow[]> >('/api/admin/upstreams').then((r) => r.data.data ?? []),
  })

  const { data: downstreams = [] } = useQuery({
    queryKey: ['admin', 'downstreams'],
    queryFn: () => api.get<ApiResponse<DownstreamRow[]>>('/api/admin/downstreams').then((r) => r.data.data ?? []),
  })

  const createMutation = useMutation({
    mutationFn: (payload: AdSiteFormValues) => api.post('/api/admin/ad-sites', payload),
    onSuccess: () => { message.success(t('admin.created')); qc.invalidateQueries({ queryKey: ['admin', 'ad-sites'] }); closeModal() },
    onError: () => message.error(t('admin.actionFailed')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<AdSiteFormValues> }) =>
      api.put(`/api/admin/ad-sites/${id}`, payload),
    onSuccess: () => { message.success(t('admin.updated')); qc.invalidateQueries({ queryKey: ['admin', 'ad-sites'] }); closeModal() },
    onError: () => message.error(t('admin.actionFailed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/ad-sites/${id}?force=1`),
    onSuccess: () => { message.success(t('admin.deleted')); qc.invalidateQueries({ queryKey: ['admin', 'ad-sites'] }) },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      message.error(err.response?.data?.error ?? t('admin.actionFailed'))
    },
  })

  const priceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      api.put(`/api/ad-sites/${id}/price`, payload),
    onSuccess: () => { message.success(t('admin.priceUpdated')); qc.invalidateQueries({ queryKey: ['admin', 'ad-sites'] }); setPriceModal(null) },
    onError: () => message.error(t('admin.actionFailed')),
  })

  const downstreamPriceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      api.put(`/api/admin/ad-sites/${id}/downstream-price`, payload),
    onSuccess: () => { message.success(t('admin.priceUpdated')); qc.invalidateQueries({ queryKey: ['admin', 'ad-sites'] }); setDownstreamPriceModal(null) },
    onError: () => message.error(t('admin.actionFailed')),
  })

  const openCreate = () => {
    setModal({})
    siteForm.resetFields()
    siteForm.setFieldsValue({ status: 'active', billing_method: 'CPM', downstream_ids: [] })
  }

  const openEdit = (row: AdSiteRow) => {
    setModal({ ...row, id: row.id })
    siteForm.resetFields()
    const upstream = upstreams.find((u) => u.name === row.upstream_name && u.ad_type_code === row.ad_type_code)
    siteForm.setFieldsValue({
      name: row.ad_site_name,
      upstream_id: upstream?.id,
      billing_method: row.billing_method,
      current_unit_price: row.current_unit_price,
      current_ratio: row.current_ratio,
      status: row.status,
      downstream_ids: row.downstream_ids ?? [],
    })
  }

  const openDownstreamPriceModal = (row: AdSiteRow) => {
    setDownstreamPriceModal(row)
    downstreamPriceForm.resetFields()
    const ds = downstreams.filter((d) => row.downstream_ids?.includes(d.id))
    const initialValues: Record<string, number> = {}
    ds.forEach((d) => {
      initialValues[`price_${d.id}`] = row.downstream_prices?.[d.id] ?? 0
    })
    downstreamPriceForm.setFieldsValue(initialValues)
  }

  const handleDownstreamPriceSubmit = () => {
    downstreamPriceForm.validateFields().then((values) => {
      if (!downstreamPriceModal) return
      const ds = downstreams.filter((d) => downstreamPriceModal.downstream_ids?.includes(d.id))
      const prices: Record<string, number> = {}
      ds.forEach((d) => {
        const key = `price_${d.id}`
        if (values[key] !== undefined) {
          prices[d.id] = values[key]
        }
      })
      downstreamPriceMutation.mutate({ id: downstreamPriceModal.id, payload: { prices } })
    })
  }

  const closeModal = () => { setModal(null); siteForm.resetFields() }

  const handleSubmit = () => {
    siteForm.validateFields().then((values) => {
      const { name, upstream_id, billing_method, current_unit_price, current_ratio, status, downstream_ids } = values
      const payload = { name, upstream_id, billing_method, current_unit_price, current_ratio, status, downstream_ids }
      if (modal && 'id' in modal && modal.id) {
        updateMutation.mutate({ id: modal.id, payload })
      } else {
        createMutation.mutate(payload)
      }
    })
  }

  const handlePriceSubmit = () => {
    priceForm.validateFields().then((values) => {
      if (!priceModal) return
      const payload = priceModal.billing_method === 'CPM'
        ? { new_unit_price: values.new_unit_price }
        : { new_ratio: values.new_ratio }
      priceMutation.mutate({ id: priceModal.id, payload })
    })
  }

  const upstreamOptions = upstreams.map((u) => ({ value: u.id, label: `${u.name} (${u.ad_type_code})` }))

  const downstreamOptions = downstreams
    .filter((d) => {
      const upstreamId = siteForm.getFieldValue('upstream_id')
      if (!upstreamId) return true
      const upstream = upstreams.find((u) => u.id === upstreamId)
      return upstream && d.ad_type_code === upstream.ad_type_code
    })
    .map((d) => ({ value: d.id, label: `${d.downstream_type} (${d.ad_type_code})` }))

  const getSiteDownstreamLabel = (row: AdSiteRow) =>
    downstreams
      .filter((d) => row.downstream_ids?.includes(d.id))
      .map((d) => d.downstream_type)
      .join(', ')

  const getSiteDownstreamPriceLabel = (row: AdSiteRow) =>
    downstreams
      .filter((d) => row.downstream_ids?.includes(d.id))
      .map((d) => {
        const price = row.downstream_prices?.[d.id]
        return price !== undefined ? `${d.downstream_type}: ${price}` : d.downstream_type
      })
      .join(', ')

  const columns: ColumnsType<AdSiteRow> = withTableEllipsis([
    { title: t('admin.adType'), dataIndex: 'ad_type_code', key: 'ad_type_code', width: 90 },
    { title: t('input.upstream'), dataIndex: 'upstream_name', key: 'upstream_name', width: 120 },
    { title: t('input.adSite'), dataIndex: 'ad_site_name', key: 'ad_site_name', width: 180, ellipsis: true },
    { title: t('admin.billingMethod'), dataIndex: 'billing_method', key: 'billing_method', width: 80 },
    {
      title: t('admin.downstreams'),
      key: 'downstreams',
      width: 130,
      render: (_: unknown, row: AdSiteRow) => {
        const ds = downstreams.filter((d) => row.downstream_ids?.includes(d.id))
        return ds.map((d) => d.downstream_type).join(', ') || '-'
      },
    },
    {
      title: t('admin.price'),
      key: 'price',
      width: 120,
      render: (_: unknown, row: AdSiteRow) =>
        row.billing_method === 'CPM'
          ? formatIsoFixed(row.current_unit_price ?? 0, 4)
          : formatIsoPercent(row.current_ratio ?? 0),
    },
    {
      title: t('admin.downstreamPrice'),
      key: 'downstream_price',
      width: 150,
      render: (_: unknown, row: AdSiteRow) => {
        const ds = downstreams.filter((d) => row.downstream_ids?.includes(d.id))
        if (ds.length === 0) return '-'
        const hasPrice = ds.some((d) => row.downstream_prices?.[d.id] !== undefined)
        if (!hasPrice) {
          return <a onClick={() => openDownstreamPriceModal(row)}>{ds.map((d) => d.downstream_type).join(', ')}</a>
        }
        return (
          <a onClick={() => openDownstreamPriceModal(row)}>
            {ds.map((d) => {
              const price = row.downstream_prices?.[d.id]
              return price !== undefined ? `${d.downstream_type}: ${formatPriceValue(price)}` : d.downstream_type
            }).join(', ')}
          </a>
        )
      },
    },
    {
      title: t('admin.status'), dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: t('input.action'), key: 'action', width: 160,
      render: (_: unknown, row: AdSiteRow) => (
        <Space size="small">
          <Button size="small" onClick={() => openEdit(row)}>{t('admin.edit')}</Button>
          <Button size="small" onClick={() => {
            setPriceModal(row)
            priceForm.setFieldsValue({
              new_unit_price: row.current_unit_price,
              new_ratio: row.current_ratio,
            })
          }}>{t('admin.price')}</Button>
          <Popconfirm
            title={t('admin.deleteSiteConfirm')}
            description={t('admin.deleteSiteDesc')}
            onConfirm={() => deleteMutation.mutate(row.id)}
            okText={t('admin.delete')}
            cancelText={t('admin.cancel')}
          >
            <Button size="small" danger>{t('admin.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ])

  const filteredSites = sites.filter((row) =>
    matchesAdminSearch(search, [
      row.ad_type_code,
      row.upstream_name,
      row.ad_site_name,
      row.billing_method,
      row.status,
      getSiteDownstreamLabel(row),
      getSiteDownstreamPriceLabel(row),
    ])
  )

  const isEdit = modal && 'id' in modal

  return (
    <>
      <div className="admin-table-toolbar">
        <Input
          className="admin-table-search"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.searchPlaceholder', { label: t('admin.adSites') })}
        />
        <Button type="primary" onClick={openCreate}>{t('admin.addSite')}</Button>
      </div>
      <Table className="app-data-table" columns={columns} dataSource={filteredSites} rowKey="id" size="small" bordered loading={isLoading} scroll={{ x: 900 }} tableLayout="fixed" />

      <Modal
        title={isEdit ? t('admin.editSite') : t('admin.createSite')}
        open={!!modal}
        onCancel={closeModal}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={500}
      >
        <Form form={siteForm} layout="vertical">
          <Form.Item name="name" label={t('admin.siteName')} rules={[{ required: true, message: t('admin.enterName') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="upstream_id" label={t('input.upstream')} rules={[{ required: true, message: t('admin.selectUpstream') }]}>
            <Select options={upstreamOptions} showSearch filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
          </Form.Item>
          <Form.Item name="downstream_ids" label={t('admin.downstreams')}>
            <Select
              mode="multiple"
              placeholder={t('admin.selectDownstream')}
              options={downstreamOptions}
              allowClear
            />
          </Form.Item>
          <Form.Item name="billing_method" label={t('admin.billingMethod')} rules={[{ required: true }]}>
            <Select options={[{ value: 'CPM', label: 'CPM' }, { value: 'RATIO', label: 'RATIO' }]} onChange={() => siteForm.setFieldValue('current_unit_price', undefined)} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.billing_method !== curr.billing_method}>
            {({ getFieldValue }) =>
              getFieldValue('billing_method') === 'CPM' ? (
                <Form.Item name="current_unit_price" label={t('admin.unitPrice')} rules={[{ required: true, message: t('admin.enterPrice') }]}>
                  <InputNumber precision={4} style={{ width: '100%' }} />
                </Form.Item>
              ) : (
                <Form.Item name="current_ratio" label={t('admin.ratio')} rules={[{ required: true, message: t('admin.enterRatio') }]}>
                  <InputNumber precision={4} min={0} max={1} style={{ width: '100%' }} />
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item name="status" label={t('admin.status')} rules={[{ required: true }]}>
            <Select options={[{ value: 'active', label: t('admin.active') }, { value: 'inactive', label: t('admin.inactive') }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${t('admin.price')} — ${priceModal?.ad_site_name}`}
        open={!!priceModal}
        onCancel={() => setPriceModal(null)}
        onOk={handlePriceSubmit}
        confirmLoading={priceMutation.isPending}
      >
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--color-warning-subtle)', borderRadius: 4, fontSize: 12 }}>
          {t('admin.priceUpdateWarning')}
        </div>
        <Form form={priceForm} layout="vertical">
          {priceModal?.billing_method === 'CPM' ? (
            <Form.Item name="new_unit_price" label={t('admin.unitPrice')} rules={[{ required: true, message: t('admin.enterPrice') }]}>
              <InputNumber precision={4} style={{ width: '100%' }} />
            </Form.Item>
          ) : (
            <Form.Item name="new_ratio" label={t('admin.ratio')} rules={[{ required: true, message: t('admin.enterRatio') }]}>
              <InputNumber precision={4} min={0} max={1} style={{ width: '100%' }} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={t('admin.downstreamPriceTitle', { name: downstreamPriceModal?.ad_site_name ?? '' })}
        open={!!downstreamPriceModal}
        onCancel={() => setDownstreamPriceModal(null)}
        onOk={handleDownstreamPriceSubmit}
        confirmLoading={downstreamPriceMutation.isPending}
      >
        <Form form={downstreamPriceForm} layout="vertical">
          {downstreamPriceModal?.downstream_ids?.map((dsId) => {
            const ds = downstreams.find((d) => d.id === dsId)
            if (!ds) return null
            return (
              <Form.Item key={dsId} name={`price_${dsId}`} label={`${ds.downstream_type} (${ds.ad_type_code})`} rules={[{ required: true, message: t('admin.enterPrice') }]}>
                <InputNumber precision={4} step={0.0001} style={{ width: '100%' }} placeholder={t('admin.downstreamPricePlaceholder')} />
              </Form.Item>
            )
          })}
        </Form>
      </Modal>
    </>
  )
}

// ============================================================
// Tab 2: Upstreams
// ============================================================
function UpstreamsTab() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<Partial<UpstreamFormValues> & { id?: number } | null>(null)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: upstreams = [], isLoading } = useQuery({
    queryKey: ['admin', 'upstreams'],
    queryFn: () => api.get<ApiResponse<UpstreamRow[]>>('/api/admin/upstreams').then((r) => r.data.data ?? []),
  })

  const { data: adTypes = [] } = useQuery({
    queryKey: ['admin', 'ad-types'],
    queryFn: () => api.get<ApiResponse<{ id: number; code: string; name: string }[]>>('/api/admin/ad-types').then((r) => r.data.data ?? []),
  })

  const createMutation = useMutation({
    mutationFn: (payload: UpstreamFormValues) => api.post('/api/admin/upstreams', payload),
    onSuccess: () => { message.success(t('admin.created')); qc.invalidateQueries({ queryKey: ['admin', 'upstreams'] }); closeModal() },
    onError: () => message.error(t('admin.actionFailed')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<UpstreamFormValues> }) =>
      api.put(`/api/admin/upstreams/${id}`, payload),
    onSuccess: () => { message.success(t('admin.updated')); qc.invalidateQueries({ queryKey: ['admin', 'upstreams'] }); closeModal() },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      message.error(err.response?.data?.error ?? t('admin.actionFailed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/upstreams/${id}`),
    onSuccess: () => { message.success(t('admin.deleted')); qc.invalidateQueries({ queryKey: ['admin', 'upstreams'] }) },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      message.error(err.response?.data?.error ?? t('admin.actionFailed'))
    },
  })

  const openCreate = () => { setModal({}); form.resetFields(); form.setFieldsValue({ status: 'active' }) }
  const openEdit = (row: UpstreamRow) => {
    setModal({ ...row, id: row.id })
    form.resetFields()
    form.setFieldsValue({ name: row.name, ad_type_id: row.ad_type_id, status: row.status })
  }
  const closeModal = () => { setModal(null); form.resetFields() }

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      if (modal && 'id' in modal && modal.id) {
        updateMutation.mutate({ id: modal.id, payload: values })
      } else {
        createMutation.mutate(values as UpstreamFormValues)
      }
    })
  }

  const columns: ColumnsType<UpstreamRow> = withTableEllipsis([
    { title: t('admin.adType'), dataIndex: 'ad_type_code', key: 'ad_type_code', width: 90 },
    { title: t('admin.upstreamName'), dataIndex: 'name', key: 'name', width: 200 },
    {
      title: t('admin.status'), dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: t('input.action'), key: 'action', width: 120,
      render: (_: unknown, row: UpstreamRow) => (
        <Space size="small">
          <Button size="small" onClick={() => openEdit(row)}>{t('admin.edit')}</Button>
          <Popconfirm title={t('admin.deleteUpstreamConfirm')} onConfirm={() => deleteMutation.mutate(row.id)} okText={t('admin.delete')} cancelText={t('admin.cancel')}>
            <Button size="small" danger>{t('admin.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ])

  const filteredUpstreams = upstreams.filter((row) =>
    matchesAdminSearch(search, [row.ad_type_code, row.ad_type_name, row.name, row.status])
  )

  const isEdit = modal && 'id' in modal

  return (
    <>
      <div className="admin-table-toolbar">
        <Input
          className="admin-table-search"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.searchPlaceholder', { label: t('admin.upstreams') })}
        />
        <Button type="primary" onClick={openCreate}>{t('admin.addUpstream')}</Button>
      </div>
      <Table className="app-data-table" columns={columns} dataSource={filteredUpstreams} rowKey="id" size="small" bordered loading={isLoading} tableLayout="fixed" />

      <Modal
        title={isEdit ? t('admin.editUpstream') : t('admin.createUpstream')}
        open={!!modal}
        onCancel={closeModal}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('admin.upstreamName')} rules={[{ required: true, message: t('admin.enterName') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="ad_type_id" label={t('admin.adType')} rules={[{ required: true, message: t('admin.selectUpstream') }]}>
            <Select options={adTypes.map((at) => ({ value: at.id, label: `${at.code} — ${at.name}` }))} />
          </Form.Item>
          <Form.Item name="status" label={t('admin.status')} rules={[{ required: true }]}>
            <Select options={[{ value: 'active', label: t('admin.active') }, { value: 'inactive', label: t('admin.inactive') }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ============================================================
// Tab 3: Downstreams
// ============================================================
function DownstreamsTab() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<Partial<DownstreamFormValues> & { id?: number } | null>(null)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: downstreams = [], isLoading } = useQuery({
    queryKey: ['admin', 'downstreams'],
    queryFn: () => api.get<ApiResponse<DownstreamRow[]>>('/api/admin/downstreams').then((r) => r.data.data ?? []),
  })

  const { data: adTypes = [] } = useQuery({
    queryKey: ['admin', 'ad-types'],
    queryFn: () => api.get<ApiResponse<{ id: number; code: string }[]>>('/api/admin/ad-types').then((r) => r.data.data ?? []),
  })

  const createMutation = useMutation({
    mutationFn: (payload: DownstreamFormValues) => api.post('/api/admin/downstreams', payload),
    onSuccess: () => { message.success(t('admin.created')); qc.invalidateQueries({ queryKey: ['admin', 'downstreams'] }); closeModal() },
    onError: () => message.error(t('admin.actionFailed')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<DownstreamFormValues> }) =>
      api.put(`/api/admin/downstreams/${id}`, payload),
    onSuccess: () => { message.success(t('admin.updated')); qc.invalidateQueries({ queryKey: ['admin', 'downstreams'] }); closeModal() },
    onError: () => message.error(t('admin.actionFailed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/downstreams/${id}`),
    onSuccess: () => { message.success(t('admin.deleted')); qc.invalidateQueries({ queryKey: ['admin', 'downstreams'] }) },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      message.error(err.response?.data?.error ?? t('admin.actionFailed'))
    },
  })

  const openCreate = () => { setModal({}); form.resetFields(); form.setFieldsValue({ status: 'active', payout_rate: 0.8 }) }
  const openEdit = (row: DownstreamRow) => {
    setModal({ id: row.id })
    form.resetFields()
    const adType = adTypes.find((at) => at.code === row.ad_type_code)
    form.setFieldsValue({ ad_type_id: adType?.id, downstream_type: row.downstream_type as 'ML' | 'LE' | 'YIYI', payout_rate: row.payout_rate, status: row.status })
  }
  const closeModal = () => { setModal(null); form.resetFields() }

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      if (modal && 'id' in modal && modal.id) {
        updateMutation.mutate({ id: modal.id, payload: values })
      } else {
        createMutation.mutate(values as DownstreamFormValues)
      }
    })
  }

  const columns: ColumnsType<DownstreamRow> = withTableEllipsis([
    { title: t('admin.adType'), dataIndex: 'ad_type_code', key: 'ad_type_code', width: 90 },
    { title: t('admin.type'), dataIndex: 'downstream_type', key: 'downstream_type', width: 90 },
    {
      title: t('admin.payoutRate'), dataIndex: 'payout_rate', key: 'payout_rate', width: 100,
      render: (v: number) => formatIsoPercent(v),
    },
    {
      title: t('admin.status'), dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: t('input.action'), key: 'action', width: 120,
      render: (_: unknown, row: DownstreamRow) => (
        <Space size="small">
          <Button size="small" onClick={() => openEdit(row)}>{t('admin.edit')}</Button>
          <Popconfirm title={t('admin.deleteDownstreamConfirm')} onConfirm={() => deleteMutation.mutate(row.id)} okText={t('admin.delete')} cancelText={t('admin.cancel')}>
            <Button size="small" danger>{t('admin.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ])

  const filteredDownstreams = downstreams.filter((row) =>
    matchesAdminSearch(search, [
      row.ad_type_code,
      row.downstream_type,
      row.status,
      row.payout_rate,
      formatIsoPercent(row.payout_rate),
    ])
  )

  const isEdit = modal && 'id' in modal

  return (
    <>
      <div className="admin-table-toolbar">
        <Input
          className="admin-table-search"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.searchPlaceholder', { label: t('admin.downstreams') })}
        />
        <Button type="primary" onClick={openCreate}>{t('admin.createDownstream')}</Button>
      </div>
      <Table className="app-data-table" columns={columns} dataSource={filteredDownstreams} rowKey="id" size="small" bordered loading={isLoading} tableLayout="fixed" />

      <Modal
        title={isEdit ? t('admin.editDownstream') : t('admin.createDownstream')}
        open={!!modal}
        onCancel={closeModal}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="ad_type_id" label={t('admin.adType')} rules={[{ required: true, message: t('admin.selectUpstream') }]}>
            <Select options={adTypes.map((at) => ({ value: at.id, label: at.code }))} />
          </Form.Item>
          <Form.Item name="downstream_type" label={t('admin.type')} rules={[{ required: true }]}>
            <Select options={[{ value: 'ML', label: 'ML' }, { value: 'LE', label: 'LE' }, { value: 'YIYI', label: 'YIYI' }]} />
          </Form.Item>
          <Form.Item name="payout_rate" label={t('admin.payoutRate')} rules={[{ required: true, message: t('admin.enterPrice') }]}>
            <InputNumber precision={4} min={0} max={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label={t('admin.status')} rules={[{ required: true }]}>
            <Select options={[{ value: 'active', label: t('admin.active') }, { value: 'inactive', label: t('admin.inactive') }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ============================================================
// Tab 4: Downstream Periods
// ============================================================
function DownstreamPeriodsTab() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [drawer, setDrawer] = useState(false)
  const [periodForm] = Form.useForm()
  const qc = useQueryClient()

  const { data: downstreams = [] } = useQuery({
    queryKey: ['admin', 'downstreams'],
    queryFn: () => api.get<ApiResponse<DownstreamRow[]>>('/api/admin/downstreams').then((r) => r.data.data ?? []),
  })

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ['admin', 'downstream-periods'],
    queryFn: () => api.get<ApiResponse<DownstreamPeriodRow[]>>('/api/admin/downstream-periods').then((r) => r.data.data ?? []),
  })

  const createMutation = useMutation({
    mutationFn: ({ downstreamId, payload }: { downstreamId: number; payload: Record<string, unknown> }) =>
      api.post(`/api/downstream/${downstreamId}/periods`, payload),
    onSuccess: () => {
      message.success(t('admin.periodCreated'))
      qc.invalidateQueries({ queryKey: ['admin', 'downstream-periods'] })
      setDrawer(false)
      periodForm.resetFields()
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      message.error(err.response?.data?.error ?? t('admin.periodCreateFail'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/downstream-periods/${id}`),
    onSuccess: () => {
      message.success(t('admin.deleted'))
      qc.invalidateQueries({ queryKey: ['admin', 'downstream-periods'] })
    },
    onError: () => message.error(t('admin.actionFailed')),
  })

  const handleSubmit = () => {
    periodForm.validateFields().then((values) => {
      const downstreamId = values.downstream_id as number
      const payload = {
        pct_ha: values.pct_hal,
        unit_price: values.unit_price,
        start_date: values.start_date.format('YYYY-MM-DD'),
        note: values.note,
      }
      createMutation.mutate({ downstreamId, payload })
    })
  }

  const columns: ColumnsType<DownstreamPeriodRow> = withTableEllipsis([
    { title: t('admin.downstreams'), dataIndex: 'downstream_type', key: 'downstream_type', width: 90 },
    { title: t('admin.adType'), dataIndex: 'ad_type_code', key: 'ad_type_code', width: 90 },
    {
      title: t('admin.pctHal'), dataIndex: 'pct_hal', key: 'pct_hal', width: 70,
      render: (v: number) => formatIsoPercent(v),
    },
    {
      title: t('admin.unitPrice'), dataIndex: 'unit_price', key: 'unit_price', width: 90,
      render: (v?: number) => (v !== undefined ? formatPriceValue(v) : '-'),
    },
    { title: t('admin.startDate'), dataIndex: 'start_date', key: 'start_date', width: 110 },
    {
      title: t('admin.endDate'), dataIndex: 'end_date', key: 'end_date', width: 110,
      render: (v?: string) => v ?? <Tag color="blue">{t('admin.current')}</Tag>,
    },
    { title: t('admin.note'), dataIndex: 'note', key: 'note', ellipsis: true },
    {
      title: t('input.action'), key: 'action', width: 168, fixed: 'right', className: 'admin-action-col',
      render: (_: unknown, row: DownstreamPeriodRow) => (
        <div className="admin-action-group">
          <Button size="small" onClick={() => {
            const ds = downstreams.find((d) => d.downstream_type === row.downstream_type && d.ad_type_code === row.ad_type_code)
            if (!ds) return
            api.put(`/api/admin/downstream-periods/${row.id}`, {
              end_date: row.end_date ? null : '2099-12-31',
            }).then(() => {
              message.success(row.end_date ? t('admin.reopened') : t('admin.closed'))
              qc.invalidateQueries({ queryKey: ['admin', 'downstream-periods'] })
            }).catch(() => message.error(t('admin.actionFailed')))
          }}>
            {row.end_date ? t('admin.reopen') : t('admin.close')}
          </Button>
          <Popconfirm title={t('admin.deleteConfirm')} onConfirm={() => deleteMutation.mutate(row.id)} okText={t('admin.delete')} cancelText={t('admin.cancel')}>
            <Button size="small" danger>{t('admin.delete')}</Button>
          </Popconfirm>
        </div>
      ),
    },
  ])

  const filteredPeriods = periods.filter((row) =>
    matchesAdminSearch(search, [
      row.downstream_type,
      row.ad_type_code,
      row.pct_hal,
      formatIsoPercent(row.pct_hal),
      row.unit_price,
      row.start_date,
      row.end_date ?? t('admin.current'),
      row.note,
    ])
  )

  return (
    <>
      <div className="admin-table-toolbar">
        <Input
          className="admin-table-search"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.searchPlaceholder', { label: t('admin.periodTab') })}
        />
        <Button type="primary" onClick={() => setDrawer(true)}>{t('admin.createPeriod')}</Button>
      </div>
      <Table
        className="admin-periods-table app-data-table"
        columns={columns}
        dataSource={filteredPeriods}
        rowKey="id"
        size="small"
        bordered
        loading={isLoading}
        scroll={{ x: 'max-content' }}
        tableLayout="fixed"
      />

      <Drawer
        title={t('admin.createPeriodTitle')}
        open={drawer}
        onClose={() => { setDrawer(false); periodForm.resetFields() }}
        styles={{ body: { paddingBottom: 80 } }}
        footer={
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setDrawer(false); periodForm.resetFields() }}>{t('admin.cancel')}</Button>
            <Button type="primary" loading={createMutation.isPending} onClick={handleSubmit}>{t('admin.save')}</Button>
          </Space>
        }
      >
        <Form form={periodForm} layout="vertical">
          <Form.Item
            name="downstream_id"
            label={t('admin.downstreams')}
            rules={[{ required: true, message: t('admin.selectDownstream') }]}
          >
            <Select
              options={downstreams.map((d) => ({ value: d.id, label: `${d.downstream_type} (${d.ad_type_code})` }))}
            />
          </Form.Item>
          <Form.Item
            name="pct_hal"
            label={t('admin.pctHal')}
            rules={[{ required: true, message: t('admin.pctHal') }]}
          >
            <InputNumber precision={2} min={0} max={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unit_price" label={t('admin.unitPrice')}>
            <InputNumber precision={4} step={0.0001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="start_date"
            label={t('admin.startDate')}
            rules={[{ required: true, message: t('admin.startDate') }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label={t('admin.note')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}

// ============================================================
// Tab 5: Users
// ============================================================
function UsersTab() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<Partial<UserFormValues> & { id?: number } | null>(null)
  const [userForm] = Form.useForm()
  const qc = useQueryClient()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<ApiResponse<UserRow[]>>('/api/users').then((r) => r.data.data ?? []),
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => api.post('/api/users', payload),
    onSuccess: () => { message.success(t('admin.created')); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); setModal(null); userForm.resetFields() },
    onError: (err: { response?: { status?: number } }) => {
      if (err.response?.status === 409) message.error(t('admin.userExists'))
      else message.error(t('admin.actionFailed'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<UserFormValues> }) =>
      api.put(`/api/users/${id}`, payload),
    onSuccess: () => { message.success(t('admin.updated')); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); setModal(null); userForm.resetFields() },
    onError: () => message.error(t('admin.actionFailed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/users/${id}`),
    onSuccess: () => { message.success(t('admin.deleted')); qc.invalidateQueries({ queryKey: ['admin', 'users'] }) },
    onError: () => message.error(t('admin.actionFailed')),
  })

  const openCreate = () => { setModal({}); userForm.resetFields(); userForm.setFieldsValue({ status: 'active', perm_data_input: false, perm_data_confirm: false, perm_admin: false }) }
  const openEdit = (user: UserRow) => {
    setModal({ ...user, id: user.id })
    userForm.resetFields()
    userForm.setFieldsValue({
      username: user.username,
      password: undefined,
      perm_data_input: user.perm_data_input,
      perm_data_confirm: user.perm_data_confirm,
      perm_admin: user.perm_admin,
      status: user.status,
    })
  }

  const handleSubmit = () => {
    userForm.validateFields().then((values) => {
      if (modal && 'id' in modal && modal.id) {
        const { username: _u, ...payload } = values
        updateMutation.mutate({ id: modal.id, payload })
      } else {
        createMutation.mutate({
          username: values.username!,
          password: values.password!,
          perm_data_input: values.perm_data_input ? 1 : 0,
          perm_data_confirm: values.perm_data_confirm ? 1 : 0,
          perm_admin: values.perm_admin ? 1 : 0,
          status: values.status,
        })
      }
    })
  }

  const columns: ColumnsType<UserRow> = withTableEllipsis([
    { title: t('admin.username'), dataIndex: 'username', key: 'username', width: 150 },
    {
      title: t('admin.permInput'), dataIndex: 'perm_data_input', key: 'perm_data_input', width: 90,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('admin.yes') : t('admin.no')}</Tag>,
    },
    {
      title: t('admin.permConfirm'), dataIndex: 'perm_data_confirm', key: 'perm_data_confirm', width: 90,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('admin.yes') : t('admin.no')}</Tag>,
    },
    {
      title: t('admin.permAdmin'), dataIndex: 'perm_admin', key: 'perm_admin', width: 80,
      render: (v: boolean) => <Tag color={v ? 'purple' : 'default'}>{v ? t('admin.yes') : t('admin.no')}</Tag>,
    },
    {
      title: t('admin.status'), dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: t('input.action'), key: 'action', width: 120,
      render: (_: unknown, row: UserRow) => (
        <Space size="small">
          <Button size="small" onClick={() => openEdit(row)}>{t('admin.edit')}</Button>
          <Popconfirm title={t('admin.deleteUserConfirm')} onConfirm={() => deleteMutation.mutate(row.id)} okText={t('admin.delete')} cancelText={t('admin.cancel')}>
            <Button size="small" danger>{t('admin.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ])

  const filteredUsers = users.filter((row) =>
    matchesAdminSearch(search, [
      row.username,
      row.status,
      row.created_at,
      row.perm_data_input ? 'input' : '',
      row.perm_data_confirm ? 'confirm' : '',
      row.perm_admin ? 'admin' : '',
    ])
  )

  const isEdit = modal && 'id' in modal

  return (
    <>
      <div className="admin-table-toolbar">
        <Input
          className="admin-table-search"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.searchPlaceholder', { label: t('admin.users') })}
        />
        <Button type="primary" onClick={openCreate}>{t('admin.addUser')}</Button>
      </div>
      <Table className="app-data-table" columns={columns} dataSource={filteredUsers} rowKey="id" size="small" bordered loading={isLoading} tableLayout="fixed" />

      <Modal
        title={isEdit ? t('admin.editUser') : t('admin.createUser')}
        open={!!modal}
        onCancel={() => { setModal(null); userForm.resetFields() }}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={userForm} layout="vertical">
          <Form.Item name="username" label={t('admin.username')} rules={[{ required: !isEdit, message: t('admin.username') }]}>
            <Input disabled={!!isEdit} />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('admin.password')}
            rules={[{ required: !isEdit, message: t('admin.password') }, { min: 6, message: t('admin.minPassword') }]}
          >
            <Input.Password placeholder={isEdit ? t('admin.leaveBlank') : ''} />
          </Form.Item>
          <Form.Item name="perm_data_input" valuePropName="checked">
            <label><input type="checkbox" style={{ marginRight: 8 }} />{t('admin.permInput')}</label>
          </Form.Item>
          <Form.Item name="perm_data_confirm" valuePropName="checked">
            <label><input type="checkbox" style={{ marginRight: 8 }} />{t('admin.permConfirm')}</label>
          </Form.Item>
          <Form.Item name="perm_admin" valuePropName="checked">
            <label><input type="checkbox" style={{ marginRight: 8 }} />{t('admin.permAdmin')}</label>
          </Form.Item>
          <Form.Item name="status" label={t('admin.status')} rules={[{ required: true }]}>
            <Select options={[{ value: 'active', label: t('admin.active') }, { value: 'inactive', label: t('admin.inactive') }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ============================================================
// AdminPage
// ============================================================
export default function AdminPage() {
  const { t } = useTranslation()
  return (
    <div className="admin-page">
      <h2 style={{ marginBottom: 16 }}>{t('admin.title')}</h2>
      <Tabs
        defaultActiveKey="adsites"
        items={[
          { key: 'adsites', label: t('admin.adSites'), children: <AdSitesTab /> },
          { key: 'upstreams', label: t('admin.upstreams'), children: <UpstreamsTab /> },
          { key: 'downstreams', label: t('admin.downstreams'), children: <DownstreamsTab /> },
          { key: 'periods', label: t('admin.periodTab'), children: <DownstreamPeriodsTab /> },
          { key: 'users', label: t('admin.users'), children: <UsersTab /> },
        ]}
      />
    </div>
  )
}
