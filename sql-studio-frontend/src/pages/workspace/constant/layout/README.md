# 工作区尺寸配置

[源码](index.ts)

sidebarLayout 是只读尺寸配置：默认 272px，范围 200–560px，主区域至少保留 520px，键盘步进 24px。工作区初始/恢复状态和 useSidebarResize 共用，避免重复数值漂移。

此配置仅服务工作区，不放入全局主题；不包含可变页面状态或浏览器存储逻辑。

resultPanelLayout 为结果区只读尺寸：默认/最小 260px，编辑器预留 280px，键盘步进 24px。useWorkspace 恢复快照与 resultsDock 展示和拖动使用相同下限，旧记录不会继续压缩表头和数据区。

resultSQLLayout 仅定义普通查询 SQL 单元格列宽 520px；只读 SQL 完整展开、自动换行，没有独立限高或滚动条。独立 DDL 页铺满表体，长内容由外层表体滚动。

resultTableLayout 定义结果表的行号列 64px、普通数据列 200px、复选框列 32px；虚拟表格据此合计数值横向滚动宽度，避免表头、固定列与虚拟表体宽度不一致。

resultTabLayout.maximumVisibleTabs=8：超过 8 个数据结果集时使用 Select 切换，仅显示当前结果标签，避免批量 SELECT 产生无限增长的标签导航。执行回执不占结果标签。

scopeCloseDialogLayout.width=560：关闭数据库或连接前的保存确认弹窗宽度。

objectTreeLayout.rowHeight=30 与既有 28px 节点内容和 2px 行距一致；scrollSaveDelay=150ms 在滚动结束后保存位置。
