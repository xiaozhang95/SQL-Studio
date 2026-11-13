# 本地化分页

`useTablePagination(): PaginationProps` 返回共享分页外观，并按已应用语言展示总条数。工作区消息、摘要、结果、历史和 Agent 结果共用；语言变化时更新文案，不改变当前页码或数据。组件可继续覆盖 pageSize、current、showTotal 等原生参数。
