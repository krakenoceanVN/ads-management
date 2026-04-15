import { Segmented } from 'antd'
import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { label: 'VI', value: 'vi' },
  { label: 'EN', value: 'en' },
  { label: 'ZH', value: 'zh' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const currentLanguage = (i18n.resolvedLanguage ?? i18n.language ?? 'vi').split('-')[0]

  return (
    <Segmented
      size="small"
      options={LANGUAGES}
      value={currentLanguage}
      onChange={(value) => {
        i18n.changeLanguage(value as string)
      }}
    />
  )
}
