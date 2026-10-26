# 外观偏好

useThemePreference 返回 preference、setPreference、mode、error。preference为system/light/dark，mode随系统变化。读取Go appearance分区，缺失时读取旧localStorage迁移；恢复成功后才保存，不再写浏览器。文件损坏或请求失败显示配置错误，不自动覆盖。首次可先用旧主题避免闪烁，后端返回后切换为保存值；保存错误交由Workspace显示。

当前缺失外观配置使用system，不读取localStorage。
