/** 用户偏好允许跟随系统，实际渲染模式只有亮色和暗色。 */
export type ThemeMode = 'light' | 'dark'
export type ThemePreference = ThemeMode | 'system'

export type FontSizePreference = 'small' | 'standard' | 'large'
export type Language = 'zh-CN' | 'en-US'

export interface AppearanceSettings {
  theme: ThemePreference
  fontSize: FontSizePreference
  language: Language
}

/** 工作区与 AI 助手共用的受控外观设置。 */
export interface AppearancePreferences {
  themePreference: ThemePreference
  fontSizePreference: FontSizePreference
  language?: Language
  onAppearanceSave: (settings: AppearanceSettings) => Promise<void>
  themeReady?: boolean
}
