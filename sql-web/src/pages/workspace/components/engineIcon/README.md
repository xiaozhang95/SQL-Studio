# 数据库品牌图标

[组件索引](../README.md) · [源码](index.tsx)

## 参数与回调

type? 为 DatabaseType；省略按 MySQL 处理。

## 行为与边界

展示 assets/databases 中未改色的品牌资源。PolarDB 三种兼容类型共用官方 PolarDB 产品标识，不冒充原生 Oracle。图标为装饰，名称由相邻文字提供。来源见资产 README。

页面私有组件从 `./components/engineIcon` 导入；只服务工作区，不通过聚合出口扩散依赖。
