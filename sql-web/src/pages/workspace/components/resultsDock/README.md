# 结果容器与伸缩

[组件索引](../README.md) · [源码](index.tsx)

参数 children、resizable、height、onHeightChange。高度由工作区受控并随加密快照保存，不再独立读写 localStorage。查询页默认 260px、最小 180px，最大按父区域减去编辑器保留空间；支持指针拖动、上下键 24px、Home/End、双击恢复，不折叠。

独立结果页 resizable=false，铺满页面并隐藏伸缩条。拖动条 5px、抓手 2px，hover/焦点/拖动均为中性 token。组件只管理尺寸交互，不持有查询数据。
