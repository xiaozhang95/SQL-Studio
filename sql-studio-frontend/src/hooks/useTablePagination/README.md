# 本地化分页

`useTablePagination({ divided = true }?): PaginationProps` 返回 Ant Design 小号分页和使用主题 token 的底栏样式。底栏随所在页面、卡片或抽屉显示背景。Agent 目录表格通过 divided=false 省略额外的顶部分隔线。按已应用语言格式化总条数。工作区消息、摘要、历史和 Agent 目录共用；语言变化时更新文案，不改变当前页码或数据。组件可继续覆盖 pageSize、current、showTotal 等原生参数。
