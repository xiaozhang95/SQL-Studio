# 系统设置入口

SystemSettings({themeMode,themePreference,onThemeChange,themeReady?}) 由工作区和 AI 助手的 PageHeader 在右上角展示。按钮使用默认尺寸，显示齿轮、「系统设置」和下拉箭头。Ant Design Dropdown 从按钮下方右对齐展开，主菜单最小宽度为 208px，窄屏继续使用同一入口。

- 「DeepSeek」行显示连接状态，点击打开现有 AISettings 弹窗。展开时优先复用近期检测结果，同一菜单同时最多发起一次检查。保存或移除配置后使旧结果失效。 [菜单连接状态](hooks/useConnectionStatus/README.md)
- 「主题模式」保留配色图标，隐藏子菜单的展开箭头。子菜单根据 themePreference 标记当前选择，选中后调用 onThemeChange 并关闭菜单。themeReady 默认为 true，主题恢复期间禁用切换。
