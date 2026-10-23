# 结果表格尺寸

[源码](index.ts)

传入当前结果 ID，返回 viewport ref 和 Table body 高度。ResizeObserver 测量容器与表头，扣除表头及边界空间；原生横纵滚动条都留在 Table body，分页在容器外。结果切换重绑观察，卸载断开。
