# 主题类型

[源码](index.ts)

ThemeMode 为 light/dark；ThemePreference 额外允许 system。偏好与实际渲染模式不混用。

FontSizePreference 为 small/standard/large，对应较小、标准和稍大字号，默认 standard。AppearancePreferences 是工作区、AI 助手和系统设置面板共用的受控契约，包含 themePreference/onThemeChange、fontSizePreference/onFontSizeChange 和可选 themeReady（面板默认 true），回调只更新对应偏好，持久化由全局 hook 负责。

导入使用 `@/typings/theme`，不追加 /index 或扩展名；改契约时同步调用方及本说明。
