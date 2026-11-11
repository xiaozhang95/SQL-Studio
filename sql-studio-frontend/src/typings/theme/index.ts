/** 用户偏好允许跟随系统，实际渲染模式只有亮色和暗色。 */
export type ThemeMode = 'light' | 'dark'
export type ThemePreference = ThemeMode | 'system'

export type FontSizePreference = 'small' | 'standard' | 'large'

/** 工作区与 AI 助手共用的受控外观设置。 */
export interface AppearancePreferences {
  themePreference: ThemePreference
  onThemeChange: (preference: ThemePreference) => void
  fontSizePreference: FontSizePreference
  onFontSizeChange: (preference: FontSizePreference) => void
  themeReady?: boolean
}
