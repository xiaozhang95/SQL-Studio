# 表格分页配置

[配置索引](../README.md) · [源码](index.ts)

tablePaginationDefaults 提供独立 Pagination 和原生 Table 共用的 small 尺寸、右对齐及隐藏每页条数切换。组件通过 [useTablePagination](../../hooks/useTablePagination/README.md) 获取使用主题 token 的底栏样式与本地化计数。

各调用方定义页大小，执行历史每页 10 条。SQL 数据结果表用虚拟滚动，不使用分页。

Agent 的连接、库表等目录表格使用同样的小号分页。各表格可覆盖每页数量、条数切换及计数文案。Agent 查询数据表使用连续滚动。
