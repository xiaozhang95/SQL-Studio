# 表格视口尺寸

[源码](index.ts)

传入结果 ID 或抽屉布局标识，返回 viewport ref 和 Table body 高度。ResizeObserver 测量容器、表头和容器内的原生分页，扣除表头、分页及其外边距、边界空间；横纵滚动仅留在 Table body。结果分页在容器外时不重复扣除。布局标识变化重绑观察，卸载断开。查询结果与执行历史共用。
