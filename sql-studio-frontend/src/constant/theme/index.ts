import { theme as antdTheme, type ThemeConfig } from 'antd'

import type { FontSizePreference, ThemeMode } from '@/typings/theme'

const logoPrimary = '#2569df'
const defaultTextColor = 'var(--ant-color-text)'
const darkAlgorithm: typeof antdTheme.darkAlgorithm = (seed, map) => ({
  ...antdTheme.darkAlgorithm(seed, map),
  colorPrimary: seed.colorPrimary
})

const defaultFontSize = antdTheme.defaultSeed.fontSize
export const uiFontSizes = { small: defaultFontSize - 2, standard: defaultFontSize, large: defaultFontSize + 2 } as const satisfies Record<FontSizePreference, number>

export const createThemeConfig = (themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig => {
  const borderColor = themeMode === 'dark' ? '#363636' : '#dedede'
  return {
    algorithm: themeMode === 'dark' ? darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: logoPrimary,
      fontSize: uiFontSizes[fontSizeMode],
      controlHeight: 30,
      colorBorder: borderColor,
      colorBorderSecondary: borderColor,
      colorSplit: borderColor,
      ...(themeMode === 'light'
        ? {
            colorBgLayout: '#f0f0f0',
            colorBgContainer: '#f5f5f5',
            colorBgElevated: '#f7f7f7'
          }
        : {})
    },
    components: {
      Typography: { colorTextDescription: defaultTextColor },
      Statistic: { colorTextDescription: defaultTextColor },
      Tabs: { itemHoverColor: defaultTextColor, itemActiveColor: defaultTextColor, itemSelectedColor: defaultTextColor }
    },
    cssVar: { key: 'sql-studio-theme' }
  }
}
