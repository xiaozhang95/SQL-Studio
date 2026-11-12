import { theme as antdTheme, type ThemeConfig } from 'antd'

import type { FontSizePreference, ThemeMode } from '@/typings/theme'

/** 与工作区、Agent 和上下文弹窗共用的主题入口。 */
export const createThemeConfig = (themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig => {
  const textColor = themeMode === 'dark' ? '#fff' : '#000'
  const config: ThemeConfig = {
    algorithm: themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      ...(fontSizeMode === 'small' ? { fontSize: 12 } : fontSizeMode === 'large' ? { fontSize: 16 } : {}),
      colorTextBase: textColor,
      colorText: textColor,
      colorTextHeading: textColor,
      colorTextLabel: textColor,
      colorBgLayout: themeMode === 'dark' ? '#000' : '#ececec'
    }
  }
  const token = antdTheme.getDesignToken(config)
  return {
    ...config,
    cssVar: { key: 'sql-studio-theme' },
    components: {
      Typography: {
        colorText: textColor,
        colorTextSecondary: textColor,
        colorTextDescription: textColor,
        colorTextTertiary: textColor,
        colorTextHeading: textColor,
        colorLink: textColor,
        colorLinkHover: textColor,
        colorLinkActive: textColor
      },
      Button: {
        colorLink: textColor,
        colorLinkHover: textColor,
        colorLinkActive: textColor,
        defaultHoverColor: textColor,
        defaultHoverBorderColor: token.colorTextTertiary,
        defaultHoverBg: token.controlItemBgHover,
        defaultActiveColor: textColor,
        defaultActiveBorderColor: token.colorTextTertiary,
        defaultActiveBg: token.controlItemBgHover
      }
    }
  }
}
