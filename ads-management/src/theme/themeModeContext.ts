import { createContext, useContext } from 'react'

export type ThemeMode = 'light' | 'contrast-soft'

export interface ThemeContextValue {
  mode: ThemeMode
  setMode: (next: ThemeMode) => void
  toggleMode: () => void
  cycleMode: () => void
}

export const ThemeModeContext = createContext<ThemeContextValue | undefined>(undefined)

export function useThemeMode() {
  const context = useContext(ThemeModeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider')
  }
  return context
}
