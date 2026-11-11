# 外观偏好

useThemePreference 返回 preference/setPreference、fontSizePreference/setFontSizePreference、mode、error、ready 和 saving。主题偏好为 system/light/dark，默认 system，实际 mode 随系统变化。字号为 small/standard/large，默认 standard；App 通过 ConfigProvider 的 fontSize token 应用到工作区、AI 助手及弹窗，较小为 12px，标准沿用 Ant Design 默认字号（14px），稍大为 16px，不改变字体族。

Go appearance 分区保存 `{theme, fontSize}`，旧记录缺少 fontSize 时按 standard 恢复。缺失配置使用默认值，不读取 localStorage。读取时校验主题及字号；读取失败或不支持的值设置 error，ready 保持 false，不自动覆盖；卸载丢弃旧读取结果。

恢复成功后才保存，主题或字号任一未保存时 saving 为 true；请求由 userState 串行写入并检查版本冲突，错误交由 Workspace 显示。不自动重试覆盖冲突。卸载或偏好变化后旧请求不能更新当前保存状态，主题系统订阅由 React 清理。
