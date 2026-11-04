# 表格分页配置

[配置索引](../README.md) · [源码](index.ts)

tablePaginationDefaults 供结果面板的独立 Pagination 和执行历史的原生 Table 共用，统一 middle 尺寸（32px 页码）、“共 X 条”文案、隐藏每页条数切换。两处使用相同的 table-pagination 底栏：右对齐、上下 8px/左右 workspace-inset、主题底色和顶部分隔线。

结果每页 50 条、历史每页 10 条；当前页及总数由各调用方负责。历史保留原生 Table 筛选/排序/分页，结果分页仍在表体滚动区外。

该定义位于公共constant目录，Agent三类结果表格同样复用默认32px分页尺寸及底栏。各表格可覆盖每页数量、是否显示条数切换和计数文案，不再单独缩小分页。
