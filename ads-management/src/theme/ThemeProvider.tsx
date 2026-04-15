import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'

type ThemeMode = 'light' | 'contrast-soft'

interface ThemeContextValue {
  mode: ThemeMode
  setMode: (next: ThemeMode) => void
  toggleMode: () => void
  cycleMode: () => void
}

const STORAGE_KEY = 'ads-management-theme-mode'
const ThemeModeContext = createContext<ThemeContextValue | undefined>(undefined)

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'contrast-soft'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'contrast' || saved === 'contrast-soft') return 'contrast-soft'
  if (saved === 'light') return 'light'
  return 'contrast-soft'
}

function getAntdThemeConfig(mode: ThemeMode) {
  const isContrast = mode === 'contrast-soft'

  return {
    algorithm: isContrast ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: isContrast ? '#2dc2de' : '#3b82f6',
      colorBgBase: isContrast ? '#06101d' : '#eef3fb',
      colorBgContainer: isContrast ? '#0d1b2f' : '#ffffff',
      colorBgElevated: isContrast ? '#132743' : '#ffffff',
      colorTextBase: isContrast ? '#f5fbff' : '#0f172a',
      colorText: isContrast ? '#eaf4ff' : '#1e293b',
      colorTextSecondary: isContrast ? '#9ac2e8' : '#64748b',
      colorBorder: isContrast ? '#3a567a' : '#cfdcec',
      borderRadius: 10,
      controlHeight: 36,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    components: {
      Table: {
        headerBg: isContrast ? '#10243e' : '#edf4ff',
        headerColor: isContrast ? '#e6f4ff' : '#1e293b',
        rowHoverBg: isContrast ? 'rgba(56, 216, 255, 0.14)' : '#eff6ff',
        borderColor: isContrast ? '#3a567a' : '#cfdbec',
      },
      Menu: isContrast
        ? {
            darkItemBg: '#0b1a2f',
            darkItemColor: '#c8dbf2',
            darkItemSelectedBg: 'rgba(56, 216, 255, 0.18)',
            darkItemSelectedColor: '#8de8ff',
            darkSubMenuItemBg: '#0b1a2f',
            darkItemHoverColor: '#f1f5f9',
          }
        : {
            itemBg: 'transparent',
            itemColor: '#475569',
            itemHoverColor: '#0f172a',
            itemHoverBg: 'rgba(59, 130, 246, 0.12)',
            itemSelectedColor: '#1d4ed8',
            itemSelectedBg: 'rgba(37, 99, 235, 0.14)',
            subMenuItemBg: 'transparent',
          },
    },
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode)

  useEffect(() => {
    if (mode === 'contrast-soft') {
      document.documentElement.setAttribute('data-theme', 'contrast')
      document.documentElement.setAttribute('data-contrast-tone', 'soft')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
      document.documentElement.removeAttribute('data-contrast-tone')
    }
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const contextValue = useMemo<ThemeContextValue>(() => ({
    mode,
    setMode,
    toggleMode: () => setMode((prev) => (prev === 'light' ? 'contrast-soft' : 'light')),
    cycleMode: () => setMode((prev) => (prev === 'light' ? 'contrast-soft' : 'light')),
  }), [mode])

  const antdConfig = useMemo(() => getAntdThemeConfig(mode), [mode])

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ConfigProvider theme={antdConfig}>{children}</ConfigProvider>
    </ThemeModeContext.Provider>
  )
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider')
  }
  return context
}
