# 侧栏标题与搜索

工作台对象栏、AI 助手会话栏、Redis 键浏览和活跃频道共用标题行和搜索行。水平内边距取 Ant Design `padding`，底边使用 `--layout-divider`。

- `SidebarHeader({ title, actions, detail? })` 渲染已翻译标题、可选状态说明和右对齐操作。行高取共享的 `appearance.panelHeaderHeight`，状态和操作由调用方提供。
- `SidebarSearch({ value, onChange, placeholder, label?, disabled?, maxLength? })` 渲染带左侧搜索图标和清空入口的受控输入框。`onChange` 接收最新文本，`label` 默认使用 `placeholder`，禁用状态和长度限制由调用方提供。搜索行固定 42px（含下边框），输入框垂直居中。与标题行、查询工具栏和表数据结果页签使用相同的底部分隔线位置。窄屏会话抽屉可单独复用该行。

过滤、列表滚动和操作状态由各业务侧栏管理。
