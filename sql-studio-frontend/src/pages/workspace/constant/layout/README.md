# 工作区尺寸配置

[源码](index.ts)

侧栏尺寸已移至共享[sidebarLayout](../../../../constant/sidebarLayout/README.md)：默认272px，范围200–560px，主区域至少保留520px，键盘步进24px。工作台与Agent使用同一份配置及宽度偏好。

此配置仅服务工作区，不放入全局主题；不包含可变页面状态或浏览器存储逻辑。

resultPanelLayout 为结果区只读尺寸：默认/最小 260px，编辑器预留 280px，键盘步进 24px。useWorkspace 恢复快照与 resultsDock 展示和拖动使用相同下限，旧记录不会继续压缩表头和数据区。

resultSQLLayout 仅定义普通查询 SQL 单元格列宽 520px；只读 SQL 完整展开、自动换行，没有独立限高或滚动条。独立 DDL 页铺满表体，长内容由外层表体滚动。

resultTableLayout 定义结果表的行号列 64px、普通数据列 200px、复选框列 32px、列宽拖拽下限 80px；虚拟表格据此合计数值横向滚动宽度，避免表头、固定列与虚拟表体宽度不一致。

resultTabLayout.maximumVisibleTabs=8：超过 8 个数据结果集时使用 Select 切换，仅显示当前结果标签，避免批量 SELECT 产生无限增长的标签导航。执行回执不占结果标签。

resultToolbarIconInset 由默认按钮尺寸与图标字号计算，用于对齐结果页签、行选择计数、执行状态与操作图标的可见边缘。

workspaceTabLayout.width=200：顶部工作区主标签固定等宽，长标题省略并保留悬停完整说明，关闭按钮位置保持一致；不改变下方消息、摘要和结果导航的宽度。

workspaceTabBarStyle 为主页面签栏和结果页签栏提供统一的 42px 栏高、页面内边距和表面底色，栏底分隔线沿用 Ant Design Tabs；与对象栏标题行、搜索行和编辑器工具栏同高，左右两栏的搜索框和工具栏保持同一水平线。

scopeCloseDialogLayout.width=560：关闭数据库或连接前的保存确认弹窗宽度。

objectTreeLayout.rowHeight=30 由连接对象树和 Redis 键树共用，与 28px 节点内容和 2px 行距一致；switcherWidth=20 用于 Redis 键树统一分组箭头与叶节点占位列宽，使同层文件夹和键图标、文字对齐；scrollSaveDelay=150ms 在连接对象树滚动结束后保存位置。

redisPanelLayout.sidebarWidth=320 由 Redis 键浏览和发布订阅共用。标题栏与搜索行沿用 `appearance.panelHeaderHeight`，与工作区其他工具栏对齐。

sqlCompletionLayout.width=360、height=256：Ant Design 语法候选下拉的最大尺寸，实际宽度受窗口限制。
