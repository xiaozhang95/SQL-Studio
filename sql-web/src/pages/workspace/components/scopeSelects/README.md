# 当前查询库表选择器

[组件索引](../README.md) · [源码](index.tsx)

## 参数与回调

scope 为 QueryScope；objects 为 useDatabaseObjects 返回值；disabled；onSelect(database, table?, schema?)。

## 行为与边界

先库再表。切库清空表和 Schema；PostgreSQL 表按 schema.name 显示，值包含 Schema，加载期间保留可读名称。选择器本身不请求 API。

页面私有组件从 `./components/scopeSelects` 导入；只服务工作区，不通过聚合出口扩散依赖。
