import { useEffect, type ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import enUS from 'antd/locale/en_US'
import viVN from 'antd/locale/vi_VN'
import zhCN from 'antd/locale/zh_CN'

export default function LocaleProviders({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const language = (i18n.resolvedLanguage ?? i18n.language ?? 'vi').split('-')[0]
  const antdLocale = language === 'zh' ? zhCN : language === 'en' ? enUS : viVN
  const dayjsLocale = language === 'zh' ? 'zh-cn' : language

  useEffect(() => {
    dayjs.locale(dayjsLocale)
  }, [dayjsLocale])

  return <ConfigProvider locale={antdLocale}>{children}</ConfigProvider>
}
