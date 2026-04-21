import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Drawer, Empty, Form, Input, Result, Space, Spin, Timeline, Typography, message } from 'antd'
import {
  ClockCircleOutlined,
  FileTextOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api, { isAdmin } from '../../api/axios'
import type { ApiResponse } from '../../types'

const { TextArea } = Input

interface AdSiteTimelineDrawerProps {
  open: boolean
  siteId?: number
  siteName?: string
  onClose: () => void
}

interface AdSiteEventRow {
  id: string
  ad_site_id: number
  event_type: 'CREATED' | 'PAUSED' | 'RESUMED' | 'DIED' | 'NOTE'
  note?: string | null
  event_date?: string
  created_at: string
}

function getEventMeta(eventType: AdSiteEventRow['event_type'], t: (key: string) => string) {
  switch (eventType) {
    case 'CREATED':
      return {
        color: '#2563eb',
        icon: <ClockCircleOutlined />,
        label: t('timeline.created'),
      }
    case 'PAUSED':
      return {
        color: '#d97706',
        icon: <PauseCircleOutlined />,
        label: t('timeline.paused'),
      }
    case 'RESUMED':
      return {
        color: '#16a34a',
        icon: <PlayCircleOutlined />,
        label: t('timeline.resumed'),
      }
    case 'DIED':
      return {
        color: '#dc2626',
        icon: <StopOutlined />,
        label: t('timeline.died'),
      }
    default:
      return {
        color: '#2563eb',
        icon: <FileTextOutlined />,
        label: t('timeline.note'),
      }
  }
}

export default function AdSiteTimelineDrawer({
  open,
  siteId,
  siteName,
  onClose,
}: AdSiteTimelineDrawerProps) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [form] = Form.useForm<{ event_date: dayjs.Dayjs }>()
  const canAddNote = isAdmin()

  const { data, isLoading, error } = useQuery<AdSiteEventRow[]>({
    queryKey: ['ad-site-events', siteId],
    enabled: open && Boolean(siteId),
    queryFn: async () => {
      const response = await api.get<ApiResponse<AdSiteEventRow[]>>(`/api/admin/ad-sites/${siteId}/events`)
      return response.data.data ?? []
    },
  })

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const trimmed = note.trim()
      if (!siteId || !trimmed) return
      const values = await form.validateFields()
      await api.post(`/api/admin/ad-sites/${siteId}/events`, {
        note: trimmed,
        eventDate: values.event_date.format('YYYY-MM-DD'),
      })
    },
    onSuccess: () => {
      setNote('')
      form.setFieldsValue({ event_date: dayjs() })
      message.success(t('timeline.noteAdded'))
      qc.invalidateQueries({ queryKey: ['ad-site-events', siteId] })
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      message.error(err.response?.data?.error ?? t('timeline.addFailed'))
    },
  })

  const items = useMemo(
    () =>
      (data ?? []).map((event) => {
        const meta = getEventMeta(event.event_type, t)
        const eventDate = event.event_date ?? event.created_at
        const showLoggedAt = event.event_date && dayjs(event.event_date).valueOf() !== dayjs(event.created_at).valueOf()

        return {
          key: event.id,
          color: meta.color,
          dot: meta.icon,
          children: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Space size={8} wrap>
                <Typography.Text strong>{meta.label}</Typography.Text>
                <Typography.Text type="secondary">
                  {dayjs(eventDate).format(event.event_date ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm')}
                </Typography.Text>
              </Space>
              {showLoggedAt ? (
                <Typography.Text type="secondary">
                  {t('timeline.loggedAt')}: {dayjs(event.created_at).format('YYYY-MM-DD HH:mm')}
                </Typography.Text>
              ) : null}
              {event.note ? <Typography.Text>{event.note}</Typography.Text> : null}
            </div>
          ),
        }
      }),
    [data, t]
  )

  return (
    <Drawer
      title={t('timeline.title', { name: siteName ?? `#${siteId ?? ''}` })}
      placement="right"
      width={560}
      open={open}
      onClose={onClose}
      destroyOnClose={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {canAddNote ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Typography.Text strong>{t('timeline.addNote')}</Typography.Text>
            <Form form={form} layout="vertical" initialValues={{ event_date: dayjs() }}>
              <Form.Item
                name="event_date"
                label={t('timeline.eventDate')}
                rules={[{ required: true, message: t('timeline.eventDateRequired') }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Form>
            <TextArea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t('timeline.eventNotePlaceholder')}
            />
            <div>
              <Button
                type="primary"
                onClick={() => addNoteMutation.mutate()}
                loading={addNoteMutation.isPending}
                disabled={!note.trim()}
              >
                {t('timeline.addNote')}
              </Button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <Spin size="large" />
          </div>
        ) : error ? (
          <Result status="error" title={t('timeline.loadError')} />
        ) : items.length === 0 ? (
          <Empty description={t('timeline.empty')} />
        ) : (
          <Timeline mode="left" items={items} />
        )}
      </div>
    </Drawer>
  )
}
