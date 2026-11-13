import { GlobalOutlined, InfoCircleOutlined, RobotOutlined, SkinOutlined } from '@ant-design/icons'

import type { FontSizePreference, Language, ThemePreference } from '@/typings/theme'

export const SettingsSection = { Model: 'model', Appearance: 'appearance', Language: 'language', About: 'about' } as const
export type SettingsSection = (typeof SettingsSection)[keyof typeof SettingsSection]

export const settingsSections = [
  { value: SettingsSection.Model, label: '模型配置', icon: RobotOutlined },
  { value: SettingsSection.Appearance, label: '外观设置', icon: SkinOutlined },
  { value: SettingsSection.Language, label: '语言设置', icon: GlobalOutlined },
  { value: SettingsSection.About, label: '关于软件', icon: InfoCircleOutlined }
] as const

export const settingsGroups = [
  { label: '模型服务', sections: [settingsSections[0]] },
  { label: '偏好设置', sections: [settingsSections[1], settingsSections[2], settingsSections[3]] }
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

export const languageOptions = [
  { value: 'zh-CN', label: '简体中文', heading: '你好，世界', sample: '数据库工作区' },
  { value: 'en-US', label: 'English', heading: 'Hello, world', sample: 'Database workspace' }
] as const satisfies readonly { value: Language; label: string; heading: string; sample: string }[]
