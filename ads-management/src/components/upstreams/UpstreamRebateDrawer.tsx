import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Drawer, Empty, Form, InputNumber, message, Modal, Popconfirm, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import api from '../../api/axios'
import type { ApiResponse, UpstreamRebateRate } from '../../types'
import { withTableEllipsis } from '../../utils/tableEllipsis'
import { formatIsoFixed } from '../../utils/numberFormat'

const { RangePicker } = DatePicker

interface UpstreamSummary {
  id: number
  name: string
  ad_type_code: string
}

interface Props {
  open: boolean
  upstream: UpstreamSummary | null
  onClose: () => void
}

interface RebateFormValues {
  rate: number
  start_date: Dayjs
  end_date?: Dayjs | null
}

interface RecalculateFormValues {
  range: [Dayjs, Dayjs]
}

export default function UpstreamRebateDrawer({ open, upstream, onClose }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [modal, setModal] = useState<UpstreamRebateRate | null | undefined>(undefined)
  const [recalculateOpen, setRecalculateOpen] = useState(false)
  const [form] = Form.useForm<RebateFormValues>()
  const [recalculateForm] = Form.useForm<RecalculateFormValues>()

  const queryKey = ['admin', 'upstream-rebates', upstream?.id ?? 0]

  const { data: rebates = [], isLoading } = useQuery({
    queryKey,
    enabled: open && Boolean(upstream?.id),
    queryFn: () =>
      api
        .get<ApiResponse<UpstreamRebateRate[]>>(`/api/admin/upstreams/${upstream!.id}/rebates`)
        .then((response) => response.data.data ?? []),
  })

  const createMutation = useMutation({
    mutationFn: (payload: { rate: number; start_date: string; end_date?: string | null }) =>
      api.post(`/api/admin/upstreams/${upstream!.id}/rebates`, payload),
    onSuccess: () => {
      message.success(t('rebate.created'))
      qc.invalidateQueries({ queryKey })
      closeModal()
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      message.error(err.response?.data?.error ?? t('rebate.actionFailed'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ rebateId, payload }: { rebateId: string; payload: { rate: number; start_date: string; end_date?: string | null } }) =>
      api.put(`/api/admin/upstreams/${upstream!.id}/rebates/${rebateId}`, payload),
    onSuccess: () => {
      message.success(t('rebate.updated'))
      qc.invalidateQueries({ queryKey })
      closeModal()
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      message.error(err.response?.data?.error ?? t('rebate.actionFailed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (rebateId: string) => api.delete(`/api/admin/upstreams/${upstream!.id}/rebates/${rebateId}`),
    onSuccess: () => {
      message.success(t('rebate.deleted'))
      qc.invalidateQueries({ queryKey })
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      message.error(err.response?.data?.error ?? t('rebate.actionFailed'))
    },
  })

  const recalculateMutation = useMutation({
    mutationFn: (payload: { start_date: string; end_date: string }) =>
      api.post(`/api/admin/upstreams/${upstream!.id}/rebates/recalculate`, payload),
    onSuccess: (response: { data?: { updated?: number } }) => {
      const updated = response.data?.updated ?? 0
      message.success(t('rebate.recalculatedSuccess', { count: updated }))
      qc.invalidateQueries({ queryKey: ['daily-input'] })
      setRecalculateOpen(false)
      recalculateForm.resetFields()
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      message.error(err.response?.data?.error ?? t('rebate.actionFailed'))
    },
  })

  const openCreate = () => {
    setModal(null)
    form.resetFields()
    form.setFieldsValue({
      rate: 0,
      start_date: dayjs(),
      end_date: null,
    })
  }

  const openEdit = (row: UpstreamRebateRate) => {
    setModal(row)
    form.resetFields()
    form.setFieldsValue({
      rate: row.rate,
      start_date: dayjs(row.start_date),
      end_date: row.end_date ? dayjs(row.end_date) : null,
    })
  }

  const closeModal = () => {
    setModal(undefined)
    form.resetFields()
  }

  const openRecalculate = () => {
    setRecalculateOpen(true)
    recalculateForm.resetFields()
    recalculateForm.setFieldsValue({
      range: [dayjs().startOf('month'), dayjs()],
    })
  }

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const payload = {
        rate: values.rate,
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
      }

      if (modal?.id) {
        updateMutation.mutate({ rebateId: modal.id, payload })
        return
      }

      createMutation.mutate(payload)
    })
  }

  const handleRecalculate = () => {
    recalculateForm.validateFields().then((values) => {
      const [startDate, endDate] = values.range
      recalculateMutation.mutate({
        start_date: startDate.format('YYYY-MM-DD'),
        end_date: endDate.format('YYYY-MM-DD'),
      })
    })
  }

  const columns: ColumnsType<UpstreamRebateRate> = withTableEllipsis([
    {
      title: t('rebate.rate'),
      dataIndex: 'rate',
      key: 'rate',
      width: 120,
      render: (value: number) => formatIsoFixed(value, 6),
    },
    {
      title: t('rebate.startDate'),
      dataIndex: 'start_date',
      key: 'start_date',
      width: 120,
    },
    {
      title: t('rebate.endDate'),
      dataIndex: 'end_date',
      key: 'end_date',
      width: 120,
      render: (value?: string | null) => value ? value : <Tag color="blue">{t('rebate.openEnded')}</Tag>,
    },
    {
      title: t('input.action'),
      key: 'action',
      width: 120,
      render: (_: unknown, row: UpstreamRebateRate) => (
        <Space size="small" className="app-table-action-group">
          <Button size="small" onClick={() => openEdit(row)}>{t('admin.edit')}</Button>
          <Popconfirm
            title={t('rebate.deleteConfirm')}
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

  return (
    <>
      <Drawer
        title={upstream ? `${t('rebate.title')} - ${upstream.name}` : t('rebate.title')}
        open={open}
        onClose={() => {
          closeModal()
          onClose()
        }}
        width={720}
        extra={
          upstream ? (
            <Space>
              <Button onClick={openRecalculate}>
                {t('rebate.recalculate')}
              </Button>
              <Button type="primary" onClick={openCreate}>
                {t('rebate.add')}
              </Button>
            </Space>
          ) : null
        }
      >
        {upstream ? (
          <Table
            className="app-data-table"
            columns={columns}
            dataSource={rebates}
            rowKey="id"
            size="small"
            bordered
            loading={isLoading}
            locale={{ emptyText: <Empty description={t('rebate.empty')} /> }}
            pagination={false}
            tableLayout="fixed"
          />
        ) : null}
      </Drawer>

      <Modal
        title={modal?.id ? t('rebate.editTitle') : t('rebate.createTitle')}
        open={modal !== undefined}
        onCancel={closeModal}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="rate"
            label={t('rebate.rate')}
            rules={[{ required: true, message: t('rebate.rateRequired') }]}
          >
            <InputNumber min={0} precision={6} step={0.0001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="start_date"
            label={t('rebate.startDate')}
            rules={[{ required: true, message: t('rebate.startDateRequired') }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_date" label={t('rebate.endDate')}>
            <DatePicker style={{ width: '100%' }} allowClear />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('rebate.recalculateTitle')}
        open={recalculateOpen}
        onCancel={() => {
          setRecalculateOpen(false)
          recalculateForm.resetFields()
        }}
        onOk={handleRecalculate}
        confirmLoading={recalculateMutation.isPending}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('rebate.recalculateDescription')}
        />
        <Form form={recalculateForm} layout="vertical">
          <Form.Item
            name="range"
            label={t('rebate.recalculateRange')}
            rules={[{ required: true, message: t('rebate.recalculateRangeRequired') }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
