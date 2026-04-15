import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DatePicker, Input } from 'antd'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import type { AdTypeCode } from '../types'
import SmInputTable from '../components/daily-input/SmInputTable'
import S360InputTable from '../components/daily-input/S360InputTable'
import BaiduInputTable from '../components/daily-input/BaiduInputTable'
import OtherInputTable from '../components/daily-input/OtherInputTable'

interface Props {
  adType: AdTypeCode
}

const AD_TYPE_LABEL: Record<AdTypeCode, string> = {
  SM: 'GS-SM',
  '360': '360',
  BAIDU_JS: 'Baidu JS',
  OTHER: 'Other',
}

export default function DailyInputPage({ adType }: Props) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date')
  const [date, setDate] = useState<string>(
    dateParam && dayjs(dateParam).isValid() ? dateParam : dayjs().format('YYYY-MM-DD')
  )
  const [search, setSearch] = useState('')

  const handleDateChange = (_: unknown, dateStr: string | null) => {
    if (dateStr) setDate(dateStr)
  }

  const disabledDate = (current: dayjs.Dayjs) => {
    return current && current > dayjs().endOf('day')
  }

  return (
    <div className="page-shell">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {t('input.title', { type: AD_TYPE_LABEL[adType] })}
        </span>
      </div>

      {adType === 'SM' && <SmInputTable date={date} search={search} />}
      {adType === '360' && <S360InputTable date={date} search={search} />}
      {adType === 'BAIDU_JS' && <BaiduInputTable date={date} search={search} />}
      {adType === 'OTHER' && <OtherInputTable date={date} search={search} />}
    </div>
  )
}
