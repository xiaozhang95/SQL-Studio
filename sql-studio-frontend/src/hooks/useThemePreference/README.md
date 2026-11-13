# 外观偏好

useThemePreference 返回 preference、fontSizePreference、language、savePreferences、mode、ready 和 saving。主题默认 system，字号默认 standard，语言默认 zh-CN。App 通过 LanguageContext 和 XProvider 应用语言，hook 同步 document.lang 与 dayjs locale。

只应用包含 theme、fontSize 和 language 的当前格式。读取失败或格式不匹配时使用本次会话默认值，不自动写回。savePreferences(settings) 通过一次写入保存三项偏好，成功时应用提交值，修订冲突时应用服务端最新值。这两种结果均返回 true，其他失败返回 false。保存期间阻止重复提交。
