# 执行历史抽屉

[组件索引](../README.md) · [源码](index.tsx)

## 参数与回调

model 提供 history/setHistory、historyOpen/setHistoryOpen、搜索值、connections、connectionId、connection、running、addTab。

## 行为与边界

最多 50 条，由 useWorkspace 持久化；入口在查询工具栏导出之后，仅展示当前查询连接 ID 的记录，同连接跨库记录均可见，不按库名或连接显示名称筛选。抽屉内使用 Ant Design Table，每页 10 条，展示状态、时间、连接、数据库、SQL、耗时和载入操作；支持状态筛选、时间/耗时排序。行详情默认收起，展开显示可复制的完整 SQL、错误，不重复连接/数据库。详情列固定 72px，标题保持单行；SQL 使用主题背景和边框，不使用大面积灰底。标题显示连接名称，入口不显示数量标签，搜索仍按 SQL/数据库匹配，长单元格省略，表格横向滚动且操作列固定在右侧。抽屉外层不滚动，顶部搜索、表头及底部分页固定；useTableViewportLayout 分配表体可用高度，仅表体滚动，展开长 SQL 不推动搜索和分页。

载入创建独立标签并恢复连接/库；连接已删除时禁用载入。清空前确认，仅移除当前连接的记录，保留其他连接历史；SQL 不在组件内自动执行。连接 ID 变化时重挂载抽屉，分页、筛选与展开状态隔离；打开入口重置搜索。

页面私有组件从 `./components/queryHistory` 导入；只服务工作区，不通过聚合出口扩散依赖。
