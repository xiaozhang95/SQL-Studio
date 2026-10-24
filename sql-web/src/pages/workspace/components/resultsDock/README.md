# 底部可伸缩面板

[组件索引](../README.md) · [源码](index.tsx)

## 参数与回调

header、children。

## 行为与边界

有结果时始终展开，右侧不提供展开/折叠按钮。默认高度 260px，最小高度 180px，最大值按可用空间减去编辑器保留区计算。支持 pointer 捕获、上下键 24px、Home/End 和双击恢复；拖到下限仍显示内容，不触发折叠。高度保存到 sqldesk.resultHeight。

页面私有组件从 `./components/resultsDock` 导入；只服务工作区，不通过聚合出口扩散依赖。
