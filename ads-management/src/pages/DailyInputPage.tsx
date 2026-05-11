import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DatePicker, Input, Spin, Alert } from 'antd'
import dayjs from 'dayjs'
import { useSearchParams, useParams } from 'react-router-dom'
import GenericInputTable from '../components/daily-input/GenericInputTable'
import { useAdTypes, findAdTypeBySlug } from '../hooks/useAdTypes'

interface Props {
  adType?: string
}

export default function DailyInputPage({ adType: adTypeProp }: Props) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const params = useParams()
  const urlAdType = params.adType // For routes like /input/:adType
  const dateParam = searchParams.get('date')
  const [date, setDate] = useState<string>(
    dateParam && dayjs(dateParam).isValid() ? dateParam : dayjs().format('YYYY-MM-DD')
  )
  const [search, setSearch] = useState('')

  // Fetch adTypes to find the actual code from slug
  const { data: adTypes = [], isLoading } = useAdTypes()

  // Priority: adTypeProp (hardcoded routes) > URL param (dynamic routes)
  const adTypeInput = adTypeProp || urlAdType

  // Convert URL slug (adTypeInput) to AdType code using dynamic lookup
  const adTypeRecord = adTypeInput ? findAdTypeBySlug(adTypes, adTypeInput) : undefined
  const adType = adTypeRecord?.code ?? ''

  // NOTE: All hooks MUST be called before any early returns
  // Handle loading state - after all hooks
  if (isLoading) {
    return <Spin tip="Đang tải dữ liệu..." />
  }

  // Handle invalid slug - after all hooks
  if (adTypeProp && !adTypeRecord && adTypes.length > 0) {
    return <Alert message={`Không tìm thấy Loại QC "${adTypeProp}" hoặc sai URL`} type="error" showIcon />
  }

  const handleDateChange = (_: unknown, dateStr: string | null) => {
    if (dateStr) setDate(dateStr)
  }

  const disabledDate = (current: dayjs.Dayjs) => {
    return current && current > dayjs().endOf('day')
  }

  const adTypeLabels: Record<string, string> = {
    SM: t('adType.gsSm'),
    '360': t('adType.360'),
    BAIDU_JS: t('adType.baidu'),
    OTHER: t('adType.other'),
  }

  return (
    <div className="page-shell">
      <div className="page-toolbar">
        <DatePicker
          value={dayjs(date)}
          format="YYYY-MM-DD"
          onChange={handleDateChange}
          disabledDate={disabledDate}
          allowClear={false}
        />
        <Input
          placeholder={t('input.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 220 }}
          allowClear
        />
        <span
          className="page-subtitle"
          style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}
          title={t('input.title', { type: adTypeLabels[adType] ?? adType })}
        >
          {t('input.title', { type: adTypeLabels[adType] ?? adType })}
        </span>
      </div>

      <GenericInputTable date={date} adType={adType} search={search} />
    </div>
  )
}
