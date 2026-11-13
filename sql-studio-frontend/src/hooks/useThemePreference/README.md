# 外观偏好

useThemePreference 返回 preference、fontSizePreference、language、savePreferences(AppearanceSettings): Promise<void>、mode、error、ready 和 saving。主题偏好为 system/light/dark，默认 system，实际 mode 随系统变化。字号为 small/standard/large，默认 standard，分别对应 12/14/16px，不改变字体族。语言为 zh-CN/en-US，默认 zh-CN。App 通过 LanguageContext 和 XProvider 应用文案、Ant Design 与 Ant Design X 组件语言；hook 同步 document.lang 与 dayjs locale。

Go appearance 分区保存 `{theme, fontSize, language}`。已保存配置必须包含 theme/fontSize，既有配置缺少 language 时按 zh-CN 读取；明确的无效语言值仍报错。文件首次缺失时初始化 system/standard/zh-CN，不读取其他存储。读取时校验三个偏好；读取失败或不支持的值设置 error，ready 保持 false，不自动覆盖；卸载丢弃旧读取结果。

读取与选择均不自动写入。系统设置统一保存时调用 savePreferences，以一次 appearance 写入保存主题、字号和语言，成功后才应用到界面，无需重启；保存期间 saving 为 true，并阻止重复提交。请求由 userState 串行写入并检查版本冲突；失败保留已应用偏好、设置 error 并抛出错误，由弹框保留草稿和提示，Workspace 也可显示错误。不自动重试覆盖冲突。主题系统订阅由 React 清理。
