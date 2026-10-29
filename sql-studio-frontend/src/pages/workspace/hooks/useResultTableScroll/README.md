# 结果表格定位

`useResultTableScroll({result,runId,view,page,search,sortKey,added})` 返回 Ant Design Table ref。结果、分页、筛选、排序和新增行数量变化后回到表体顶部；两次 animation frame 跨过虚拟列表的动态行高测量及锚点补偿，避免新增输入框被表头遮挡或保存后跳到底部。卸载及后续定位取消旧帧，不在普通滚动或单元格输入时重置位置。
