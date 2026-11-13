# 表格分页配置

[配置索引](../README.md) · [源码](index.ts)

tablePaginationDefaults 提供独立 Pagination 和原生 Table 共用的 middle 尺寸（32px 页码）、右对齐及隐藏每页条数切换。组件通过 [useTablePagination](../../hooks/useTablePagination/README.md) 获取布局默认值与当前语言的“共 X 条”计数。分页共用 table-pagination 底栏的上下 8px、左右 workspace-inset 间距、主题底色和顶部分隔线。

结果每页 50 条、历史每页 10 条；当前页及总数由各调用方负责。历史保留原生 Table 筛选/排序/分页，结果分页仍在表体滚动区外。

该定义位于公共constant目录，Agent三类结果表格同样复用默认32px分页尺寸及底栏。各表格可覆盖每页数量、是否显示条数切换和计数文案，不再单独缩小分页。
