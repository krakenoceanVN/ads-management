import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import 'dayjs/locale/en'
import 'dayjs/locale/vi'
import 'dayjs/locale/zh-cn'
import './index.css'
import './i18n'
import App from './App.tsx'
import LocaleProviders from './providers/LocaleProviders.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 15,
      retry: 1,
    },
  },
})

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
