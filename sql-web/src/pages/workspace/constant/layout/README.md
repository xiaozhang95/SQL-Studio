# 工作区尺寸配置

[源码](index.ts)

sidebarLayout 是只读尺寸配置：默认 272px，范围 200–560px，主区域至少保留 520px，键盘步进 24px。工作区初始/恢复状态和 useSidebarResize 共用，避免重复数值漂移。

此配置仅服务工作区，不放入全局主题；不包含可变页面状态或浏览器存储逻辑。

resultPanelLayout 为结果区只读尺寸：默认/最小 260px，编辑器预留 280px，键盘步进 24px。useWorkspace 恢复快照与 resultsDock 展示和拖动使用相同下限，旧记录不会继续压缩表头和数据区。

resultSQLLayout 为查询结果 SQL 单元格的只读尺寸：列宽 520px、预览最大高度 160px，由 queryResults 的列配置与 SQLPreview 容器共用。独立 DDL 页仍铺满表体并由表体滚动。
