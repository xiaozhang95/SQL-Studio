# 外观偏好

useThemePreference 返回 preference、fontSizePreference、savePreferences(AppearanceSettings): Promise<void>、mode、error、ready 和 saving。主题偏好为 system/light/dark，默认 system，实际 mode 随系统变化。字号为 small/standard/large，默认 standard；App 通过 ConfigProvider 的 fontSize token 应用到工作区、AI 助手及弹窗，较小为 12px，标准沿用 Ant Design 默认字号（14px），稍大为 16px，不改变字体族。

Go appearance 分区保存 `{theme, fontSize}`，已保存配置必须同时包含 theme/fontSize；只有文件首次缺失时初始化 system/standard，不读取其他存储。读取时校验主题及字号；读取失败或不支持的值设置 error，ready 保持 false，不自动覆盖；卸载丢弃旧读取结果。

读取与选择均不自动写入。系统设置统一保存时调用 savePreferences，以一次 appearance 写入保存主题和字号，成功后才应用到界面；保存期间 saving 为 true，并阻止重复提交。请求由 userState 串行写入并检查版本冲突；失败保留已应用外观、设置 error 并抛出错误，由弹框保留草稿和提示，Workspace 也可显示错误。不自动重试覆盖冲突。主题系统订阅由 React 清理。
