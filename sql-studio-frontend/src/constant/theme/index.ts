import { theme as antdTheme, type ThemeConfig } from 'antd'

import type { FontSizePreference, ThemeMode } from '@/typings/theme'

/** 与工作区、Agent 和上下文弹窗共用的主题入口。 */
export const createThemeConfig = (themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig => {
  const textColor = themeMode === 'dark' ? '#fff' : '#000'
  const primaryColor = antdTheme.defaultSeed.colorSuccess
  const selectedBackground = themeMode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'

  return {
    algorithm: themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      ...(fontSizeMode === 'small' ? { fontSize: 12 } : fontSizeMode === 'large' ? { fontSize: 16 } : {}),
      // 主色与信息色共用绿色，亮暗及交互色由算法派生。
      colorPrimary: primaryColor,
      colorInfo: primaryColor,
      colorTextBase: textColor,
      colorText: textColor,
      colorTextHeading: textColor,
      colorTextLabel: textColor,
      colorBgLayout: themeMode === 'dark' ? '#000' : '#ececec',
      // 已选项在静止、悬停和聚焦时保持同一填充。
      controlItemBgActive: selectedBackground,
      controlItemBgActiveHover: selectedBackground
    },
    cssVar: { key: 'sql-studio-theme' }
  }
}
