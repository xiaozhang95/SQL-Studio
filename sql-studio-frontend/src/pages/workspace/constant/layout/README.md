# 工作区尺寸配置

[源码](index.ts)

侧栏尺寸已移至共享[sidebarLayout](../../../../constant/sidebarLayout/README.md)：默认272px，范围200–560px，主区域至少保留520px，键盘步进24px。工作台与Agent使用同一份配置及宽度偏好。

此配置仅服务工作区，不放入全局主题；不包含可变页面状态或浏览器存储逻辑。

resultPanelLayout 为结果区只读尺寸：默认/最小 260px，编辑器预留 280px，键盘步进 24px。useWorkspace 恢复快照与 resultsDock 展示和拖动使用相同下限，旧记录不会继续压缩表头和数据区。

resultSQLLayout 仅定义普通查询 SQL 单元格列宽 520px；只读 SQL 完整展开、自动换行，没有独立限高或滚动条。独立 DDL 页铺满表体，长内容由外层表体滚动。

resultTableLayout 定义结果表的行号列 64px、普通数据列 200px、复选框列 32px、列宽拖拽下限 80px；虚拟表格据此合计数值横向滚动宽度，避免表头、固定列与虚拟表体宽度不一致。

resultTabLayout.maximumVisibleTabs 为 8。超过 8 个数据结果集时使用 Select 切换，标签栏保留当前结果。执行回执不占结果标签。弹性布局使用 260px 的页签基准宽度。选择器与筛选框同时出现时，通过子网格共用列宽，窄布局只单独放置页签栏。`resultControlProps` 为结果集选择器和筛选框提供同一组中号尺寸（宽 220px，高 30px），`resultToolbarSpacing` 提供共用的 4px 垂直留白和 8px 组间距。

workspaceConnectionIconSize 为连接选择器与执行历史抽屉标题共用的 20px 引擎图标尺寸。

resultToolbarIconInset 由默认按钮尺寸与图标字号计算，提供结果页签的水平内边距。执行状态图标按 `controlHeight` 居中，与操作按钮采用相同宽度。

workspaceTabLayout.width=200：顶部工作区主标签固定等宽，长标题省略并保留悬停完整说明，关闭按钮位置保持一致；不改变下方消息、摘要和结果导航的宽度。

workspaceTabBarStyle 为主页面签栏提供 42px 栏高和表面底色，分隔线在栏内绘制。结果页签栏由外层绘制分隔线，`resultNavigationContentHeight` 从标准栏高中扣除边框线宽。workspaceInset 引用 `--workspace-inset`（16px），供页签栏、消息列表、摘要统计、结果工具栏和底部条数栏使用。摘要表和结果表的容器横向贴边。workspaceTabBarSpacer 为主页面签预留滚动边距。workspaceTabLayout 同时约定主页面签宽和更多面板的宽度及滚动区域上限。

scopeCloseDialogLayout.width=560：关闭数据库或连接前的保存确认弹窗宽度。

`connectionFormLabelWidth` 按界面语言提供连接表单的共享标签列宽。中文给必填标记、字段名和冒号留足空间，英文以表单宽度为基准弹性分配标签列。两种语言的字号变化都会同步调整列宽。

objectTreeLayout.rowHeight=30 由连接对象树和 Redis 键树共用，与 28px 节点内容和 2px 行距一致；switcherWidth=20 用于 Redis 键树统一分组箭头与叶节点占位列宽，使同层文件夹和键图标、文字对齐；scrollSaveDelay=150ms 在连接对象树滚动结束后保存位置。

redisPanelLayout.sidebarWidth=320 由 Redis 键浏览和发布订阅共用。标题栏与搜索行沿用 `appearance.panelHeaderHeight`，与工作区其他工具栏对齐。

`queryScopeLayout` 定义查询范围选择器的统一上限 240px 和换行前的最小宽度 144px。

sqlCompletionLayout.width=360、height=256：Ant Design 语法候选下拉的最大尺寸，实际宽度受窗口限制。
