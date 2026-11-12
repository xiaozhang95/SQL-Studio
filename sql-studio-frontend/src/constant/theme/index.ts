import { theme as antdTheme, type ThemeConfig } from 'antd'

import type { FontSizePreference, ThemeMode } from '@/typings/theme'

/** 与工作区、Agent 和上下文弹窗共用的主题入口。 */
export const createThemeConfig = (themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig => {
  const textColor = themeMode === 'dark' ? '#fff' : '#000'
  const config: ThemeConfig = {
    algorithm: themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      ...(fontSizeMode === 'small' ? { fontSize: 12 } : fontSizeMode === 'large' ? { fontSize: 16 } : {}),
      // 主色采用 Ant Design 默认 success 绿色，亮暗及交互色由算法派生。
      colorPrimary: antdTheme.defaultSeed.colorSuccess,
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
    // 所有选中背景沿用 Ant Design 的中性填充，普通悬停使用更浅的层级。
    token: {
      ...config.token,
      controlItemBgActive: token.colorFillSecondary,
      controlItemBgActiveHover: token.colorFill
    },
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
        colorLinkActive: textColor,
        linkHoverDecoration: 'underline'
      }
    }
  }
}
