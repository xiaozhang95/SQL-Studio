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
    // 导航与候选项统一使用主题实色选中态，表格数据行另用浅色衬底。
    token: {
      ...config.token,
      controlItemBgActive: token.colorPrimary,
      controlItemBgActiveHover: token.colorPrimaryHover
    },
    cssVar: { key: 'sql-studio-theme' },
    components: {
      Select: { optionSelectedColor: token.colorTextLightSolid },
      Menu: { itemSelectedColor: token.colorTextLightSolid },
      Tree: { nodeSelectedColor: token.colorTextLightSolid },
      // 数据行包含状态色、NULL 和编辑控件，保留主题浅色选中底以确保内容可读。
      Table: { rowSelectedBg: token.colorPrimaryBg, rowSelectedHoverBg: token.colorPrimaryBgHover },
      Typography: {
        colorText: textColor,
        colorTextSecondary: textColor,
        colorTextDescription: textColor,
        colorTextTertiary: textColor,
        colorTextHeading: textColor,
        colorLink: textColor,
        colorLinkHover: textColor,
        colorLinkActive: textColor
      }
    }
  }
}
