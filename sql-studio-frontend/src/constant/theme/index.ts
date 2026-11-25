import { theme as antdTheme, type ThemeConfig } from 'antd'

import type { FontSizePreference, ThemeMode } from '@/typings/theme'

type Palette = {
  success: string
  warning: string
  error: string
  canvas: string
  surface: string
  elevated: string
  border: string
  borderStrong: string
  fill: string
  fillSecondary: string
  fillTertiary: string
  fillQuaternary: string
  hover: string
  active: string
  mask: string
}

// 来自 public/studio.svg 的放大镜描边渐变。
const logoPrimary = '#2569df'

/** 与工作区、Agent 和上下文弹窗共用的主题入口。 */
const palettes: Record<ThemeMode, Palette> = {
  light: {
    success: '#16a34a',
    warning: '#b45309',
    error: '#dc2626',
    canvas: '#f4f6f8',
    surface: '#ffffff',
    elevated: '#ffffff',
    border: '#e2e7ec',
    borderStrong: '#cfd7de',
    fill: '#eef1f5',
    fillSecondary: '#f0f3f7',
    fillTertiary: '#e9edf2',
    fillQuaternary: '#f0f3f7',
    hover: '#f0f3f7',
    active: '#f0f3f7',
    mask: 'rgba(17, 24, 39, 0.38)'
  },
  dark: {
    success: '#42d47c',
    warning: '#fbbf24',
    error: '#f87171',
    canvas: '#0a0a0a',
    surface: '#131313',
    elevated: '#1a1a1a',
    border: '#282828',
    borderStrong: '#3a3a3a',
    fill: '#202020',
    fillSecondary: '#1a1a1a',
    fillTertiary: '#232323',
    fillQuaternary: '#202020',
    hover: '#202020',
    active: '#202020',
    mask: 'rgba(0, 0, 0, 0.62)'
  }
}

const defaultFontSize = antdTheme.defaultSeed.fontSize
export const uiFontSizes = { small: defaultFontSize - 2, standard: defaultFontSize, large: defaultFontSize + 2 } as const satisfies Record<FontSizePreference, number>

export const createThemeConfig = (themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig => {
  const palette = palettes[themeMode]
  const outline = (color: string) => `color-mix(in srgb, ${color} 20%, transparent)`
  return {
    algorithm: themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      fontSize: uiFontSizes[fontSizeMode],
      controlHeight: 30,
      // 保留原生焦点边框和键盘轮廓，统一减弱控件边框外的焦点阴影。
      controlOutlineWidth: 1,
      controlOutline: outline(logoPrimary),
      colorWarningOutline: outline(palette.warning),
      colorErrorOutline: outline(palette.error),
      colorPrimary: logoPrimary,
      colorInfo: logoPrimary,
      colorSuccess: palette.success,
      colorWarning: palette.warning,
      colorError: palette.error,
      colorBgLayout: palette.canvas,
      colorBgContainer: palette.surface,
      colorBgElevated: palette.elevated,
      colorBgMask: palette.mask,
      colorBorder: palette.borderStrong,
      colorBorderSecondary: palette.border,
      colorFill: palette.fill,
      colorFillSecondary: palette.fillSecondary,
      colorFillTertiary: palette.fillTertiary,
      colorFillQuaternary: palette.fillQuaternary,
      colorFillAlter: palette.fillQuaternary,
      // 已选项在静止、悬停和聚焦时保持同一填充。
      controlItemBgActive: palette.active,
      controlItemBgActiveHover: palette.active,
      controlItemBgHover: palette.hover
    },
    cssVar: { key: 'sql-studio-theme' }
  }
}
