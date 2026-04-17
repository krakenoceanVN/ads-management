import { StrictMode, useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import enUS from 'antd/locale/en_US'
import viVN from 'antd/locale/vi_VN'
import zhCN from 'antd/locale/zh_CN'
import 'dayjs/locale/en'
import 'dayjs/locale/vi'
import 'dayjs/locale/zh-cn'
import './index.css'
import './i18n'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 15,
      retry: 1,
    },
  },
})

function LocaleProviders({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const language = (i18n.resolvedLanguage ?? i18n.language ?? 'vi').split('-')[0]
  const antdLocale = language === 'zh' ? zhCN : language === 'en' ? enUS : viVN
  const dayjsLocale = language === 'zh' ? 'zh-cn' : language

  useEffect(() => {
    dayjs.locale(dayjsLocale)
  }, [dayjsLocale])

  return <ConfigProvider locale={antdLocale}>{children}</ConfigProvider>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocaleProviders>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </LocaleProviders>
    </QueryClientProvider>
  </StrictMode>,
)
