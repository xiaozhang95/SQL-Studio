import { theme as antdTheme, type ThemeConfig } from 'antd'

import type { FontSizePreference, ThemeMode } from '@/typings/theme'

type Palette = {
  primary: string
  success: string
  warning: string
  error: string
  text: string
  textSecondary: string
  textTertiary: string
  textQuaternary: string
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

/** 与工作区、Agent 和上下文弹窗共用的主题入口。 */
const palettes: Record<ThemeMode, Palette> = {
  light: {
    primary: '#15803d',
    success: '#16a34a',
    warning: '#b45309',
    error: '#dc2626',
    text: '#000000',
    textSecondary: '#556055',
    textTertiary: '#7d887d',
    textQuaternary: '#aab3aa',
    canvas: '#f4f6f2',
    surface: '#ffffff',
    elevated: '#ffffff',
    border: '#e2e7df',
    borderStrong: '#cfd7cd',
    fill: '#eef1ec',
    fillSecondary: '#f0f3ee',
    fillTertiary: '#e9ede6',
    fillQuaternary: '#f0f3ee',
    hover: '#f0f3ee',
    active: '#f0f3ee',
    mask: 'rgba(18, 24, 19, 0.38)'
  },
  dark: {
    primary: '#42d47c',
    success: '#42d47c',
    warning: '#fbbf24',
    error: '#f87171',
    text: '#ffffff',
    textSecondary: '#a9b1a7',
    textTertiary: '#7e877d',
    textQuaternary: '#586157',
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

const baseFontSize = { small: 12, standard: 14, large: 16 } as const satisfies Record<FontSizePreference, number>

export const createThemeConfig = (themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig => {
  const palette = palettes[themeMode]
  const tint = (color: string, weight: number, background = palette.surface) => `color-mix(in srgb, ${color} ${weight}%, ${background})`
  return {
    algorithm: themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      fontSize: baseFontSize[fontSizeMode],
      controlHeight: 30,
      // 保留原生焦点边框和键盘轮廓，统一减弱控件边框外的焦点阴影。
      controlOutlineWidth: 1,
      controlOutline: tint(palette.primary, 20, 'transparent'),
      colorWarningOutline: tint(palette.warning, 20, 'transparent'),
      colorErrorOutline: tint(palette.error, 20, 'transparent'),
      // 主色与信息色共用绿色，亮暗及交互色由算法派生。
      colorPrimary: palette.primary,
      colorInfo: palette.primary,
      colorSuccess: palette.success,
      colorWarning: palette.warning,
      colorError: palette.error,
      colorTextBase: palette.text,
      colorText: palette.text,
      colorTextHeading: palette.text,
      colorTextLabel: palette.text,
      colorTextSecondary: palette.textSecondary,
      colorTextTertiary: palette.textTertiary,
      colorTextQuaternary: palette.textQuaternary,
      colorTextLightSolid: themeMode === 'dark' ? '#06170c' : '#ffffff',
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
    components: {
      Alert: {
        colorInfoBg: tint(palette.primary, 12),
        colorInfoBorder: tint(palette.primary, 24),
        colorSuccessBg: tint(palette.success, 12),
        colorSuccessBorder: tint(palette.success, 24),
        colorWarningBg: tint(palette.warning, 12),
        colorWarningBorder: tint(palette.warning, 24),
        colorErrorBg: tint(palette.error, 12),
        colorErrorBorder: tint(palette.error, 24)
      },
      Steps: { colorPrimaryBg: tint(palette.primary, 12) },
      Modal: { contentBg: palette.surface, headerBg: palette.surface, footerBg: palette.surface },
      // 文本按钮与默认按钮的悬停/按下背景与树、下拉、表格共用同一档。
      Button: {
        primaryShadow: 'none',
        defaultShadow: 'none',
        dangerShadow: 'none',
        textHoverBg: palette.hover,
        defaultHoverBg: palette.hover,
        defaultActiveBg: palette.active
      }
    },
    cssVar: { key: 'sql-studio-theme' }
  }
}
