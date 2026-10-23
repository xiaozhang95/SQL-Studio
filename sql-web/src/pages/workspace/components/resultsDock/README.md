# 底部可伸缩面板

[组件索引](../README.md) · [源码](index.tsx)

## 参数与回调

header、actions?、children、collapsed、onCollapsedChange。

## 行为与边界

默认高度 260px，折叠 48px，最小展开 180px，最大值按可用空间减去编辑器保留区计算。支持 pointer 捕获、上下键 24px、Home/End、Enter 和双击恢复；高度保存到 sqldesk.resultHeight。

页面私有组件从 `./components/resultsDock` 导入；只服务工作区，不通过聚合出口扩散依赖。
