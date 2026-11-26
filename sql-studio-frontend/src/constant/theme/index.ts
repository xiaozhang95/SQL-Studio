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
  const dark = themeMode === 'dark'
  const borderColor = dark ? '#242424' : '#e2e2e2'
  const selectedBackground = dark ? '#303030' : '#e6e6e6'
  return {
    algorithm: dark ? darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: logoPrimary,
      fontSize: uiFontSizes[fontSizeMode],
      controlHeight: 30,
      colorBorder: borderColor,
      colorBorderSecondary: borderColor,
      colorSplit: borderColor,
      colorBgElevated: dark ? '#181818' : '#f7f7f7',
      controlItemBgActive: selectedBackground,
      controlItemBgActiveHover: selectedBackground,
      ...(dark
        ? {}
        : {
            colorBgLayout: '#f0f0f0',
            colorBgContainer: '#f5f5f5'
          })
    },
    components: {
      Typography: { colorTextDescription: defaultTextColor },
      Statistic: { colorTextDescription: defaultTextColor },
      Tabs: { itemHoverColor: defaultTextColor, itemActiveColor: defaultTextColor, itemSelectedColor: defaultTextColor }
    },
    cssVar: { key: 'sql-studio-theme' }
  }
}
