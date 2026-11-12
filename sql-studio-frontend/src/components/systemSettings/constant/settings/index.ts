import { FontSizeOutlined, RobotOutlined, SkinOutlined } from '@ant-design/icons'

import type { FontSizePreference, ThemePreference } from '@/typings/theme'

export const SettingsSection = { Model: 'model', Theme: 'theme', FontSize: 'font-size' } as const
export type SettingsSection = (typeof SettingsSection)[keyof typeof SettingsSection]

export const settingsSections = [
  { value: SettingsSection.Model, label: '模型配置', icon: RobotOutlined },
  { value: SettingsSection.Theme, label: '主题模式', icon: SkinOutlined },
  { value: SettingsSection.FontSize, label: '界面字号', icon: FontSizeOutlined }
] as const

export const settingsGroups = [
  { label: '模型服务', sections: [settingsSections[0]] },
  { label: '外观设置', sections: [settingsSections[1], settingsSections[2]] }
] as const

export const themeOptions = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '暗色' }
] as const satisfies readonly { value: ThemePreference; label: string }[]

export const fontSizeOptions = [
  { value: 'small', label: '较小（12px）', fontSize: 12 },
  { value: 'standard', label: '标准（14px）', fontSize: 14 },
  { value: 'large', label: '稍大（16px）', fontSize: 16 }
] as const satisfies readonly { value: FontSizePreference; label: string; fontSize: number }[]

export const settingsLayout = { width: 860, height: 440, sidebarWidth: 180, previewHeight: 96, cardMinWidth: 132 } as const
