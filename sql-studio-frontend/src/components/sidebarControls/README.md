# 侧栏标题与搜索

工作台对象栏与 AI 助手会话栏共用标题行和搜索行。两行独立渲染，下沿使用主题分隔线，水平内边距取 Ant Design `padding`。

- `SidebarHeader({ title, count, actions })` 渲染已翻译标题、数量和右对齐操作。标题行最小高度 42px，操作由调用方提供。
- `SidebarSearch({ value, onChange, placeholder, label? })` 渲染带搜索图标和清空入口的受控输入框。`onChange` 接收最新文本，`label` 默认使用 `placeholder`。搜索行上下内边距取 `paddingXS`。窄屏会话抽屉可单独复用该行。

过滤、列表滚动和操作状态由各业务侧栏管理。
