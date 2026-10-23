# 执行历史抽屉

[组件索引](../README.md) · [源码](index.tsx)

## 参数与回调

model 提供 history/setHistory、historyOpen/setHistoryOpen、搜索值、connections、running、addTab。

## 行为与边界

最多 50 条，由 useWorkspace 持久化；抽屉内使用 Ant Design Collapse accordion，默认收起，只展开一条记录，摘要显示状态、时间和单行 SQL，展开后显示完整 SQL、库/耗时、载入操作及错误。标题及侧栏入口不显示数量标签，搜索仍按 SQL/数据库匹配，长摘要省略而不撑宽抽屉。

载入创建独立标签并恢复连接/库/Schema；连接已删除时禁用载入。清空前确认，SQL 不在组件内自动执行。

页面私有组件从 `./components/queryHistory` 导入；只服务工作区，不通过聚合出口扩散依赖。
