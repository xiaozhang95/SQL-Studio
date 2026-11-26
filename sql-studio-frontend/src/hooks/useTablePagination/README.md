# 本地化分页

`useTablePagination({ divided = true }?): PaginationProps` 返回继承全局标准尺寸的 Ant Design 分页和使用主题 token 的底栏样式。底栏随所在页面、卡片或抽屉显示背景。Agent 目录表格通过 divided=false 省略额外的顶部分隔线。按已应用语言格式化总条数，语言变化时更新文案。组件可继续覆盖 pageSize、current、showTotal 等原生参数。
