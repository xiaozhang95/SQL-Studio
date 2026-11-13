# 主题类型

[源码](index.ts)

ThemeMode 为 light/dark；ThemePreference 额外允许 system。偏好与实际渲染模式不混用。

FontSizePreference 为 small/standard/large，对应较小、标准和稍大字号，默认 standard。Language 为 zh-CN/en-US，默认 zh-CN。AppearanceSettings 包含 theme、fontSize 与 language，表示一起提交的偏好值。AppearancePreferences 是工作区、AI 助手和系统设置共用的受控契约，包含已应用的 themePreference、fontSizePreference、可选 language（缺省 zh-CN）、异步 onAppearanceSave(AppearanceSettings): Promise<void> 和可选 themeReady（默认 true）。系统设置维护草稿，仅总保存时调用回调；全局 hook 保存成功后才应用偏好，失败抛出错误。

导入使用 `@/typings/theme`，不追加 /index 或扩展名；改契约时同步调用方及本说明。
