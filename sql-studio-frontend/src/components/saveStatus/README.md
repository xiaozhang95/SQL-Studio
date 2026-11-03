# 配置保存状态

SaveStatus由工作区和Agent共用，接收restoring、saving、可选error；可选label/savedText/savedHint指定可访问名称、完成文案和说明，默认保留工作区“已保存到本机”。错误优先显示红色失败图标；恢复/保存显示蓝色旋转图标；完成显示绿色勾选。颜色使用Ant Design token，亮暗主题自动适配。Tooltip展示错误详情或保存含义，aria-live通知状态变化，不承载持久化逻辑。
