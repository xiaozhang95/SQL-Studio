# 系统设置入口

SystemSettings({themeMode,themePreference,onThemeChange,themeReady?,navigation})在侧栏底部打开向上、左对齐的 Ant Design Dropdown。工作区、Agent 和窄屏历史抽屉共用菜单，按钮右侧箭头随菜单展开或收起改变方向，与外观子菜单箭头共用 Ant Design 的 colorIcon。

- 第一行通过 navigation.onSelect 切换到 navigation.destination。navigation.disabled 控制是否可用。
- DeepSeek 配置行打开现有 AISettings 弹窗。打开菜单时先读取已保存配置，已配置时请求模型列表验证连通性，并显示检测中、未配置、已连接或检测失败。关闭菜单时取消尚未完成的检查。
- 外观使用子菜单，根据 themePreference 标记当前选择。选中后调用 onThemeChange，关闭菜单。themeReady 默认为 true，主题恢复期间禁用切换。
