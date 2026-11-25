import { theme as antdTheme, type ThemeConfig } from 'antd'

import type { FontSizePreference, ThemeMode } from '@/typings/theme'

const logoPrimary = '#2569df'

const defaultFontSize = antdTheme.defaultSeed.fontSize
export const uiFontSizes = { small: defaultFontSize - 2, standard: defaultFontSize, large: defaultFontSize + 2 } as const satisfies Record<FontSizePreference, number>

export const createThemeConfig = (themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig => {
  return {
    algorithm: themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: logoPrimary,
      fontSize: uiFontSizes[fontSizeMode],
      controlHeight: 30
    },
    cssVar: { key: 'sql-studio-theme' }
  }
}
