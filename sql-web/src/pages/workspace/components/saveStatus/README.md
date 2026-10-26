# 配置保存状态

SaveStatus 接收 restoring、saving、可选 error。错误优先显示红色失败图标；恢复/保存显示蓝色旋转图标；完成显示绿色勾选与已保存到本机。颜色使用Ant Design token，亮暗主题自动适配。Tooltip展示错误详情或保存含义，aria-live通知状态变化，不承载实际持久化逻辑。
