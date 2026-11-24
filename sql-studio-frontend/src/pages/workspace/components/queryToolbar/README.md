# 查询工具栏

`QueryToolbar` 接收当前查询页的范围、已保存的连接和对象元数据。SQL 与 Redis 共用左侧连接和库下拉，dropdown 高度沿用 Ant Design 默认控件尺寸。调用者可在 `runActions` 提供运行/取消按钮，通过 children 提供右侧操作图标。工具栏最小高度 42px，与主页面签栏和对象栏标题行同高；布局由 Flex 管理。内边距、表面和底部分隔线取主题 token。

工作台与 Redis 编辑器共用 [RunButton](../runButton/README.md) 作为唯一 primary 运行操作，并显示执行快捷键；执行中显示 text danger「取消执行」。AI 补全、优化、导入、导出和历史使用图标或短文本操作。Redis 使用 `compact` 收缩两个下拉的宽度，空间足够时连接、库和运行按钮在同一行。窄屏允许换行，右侧操作保持靠右。

工具栏只负责布局与分组，不读取执行状态；按钮的禁用、加载、危险语义由调用方传入。