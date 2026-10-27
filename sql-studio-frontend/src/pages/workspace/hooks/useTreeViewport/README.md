# 对象树虚拟视口

`useTreeViewport(top,onTopChange,ready)` 返回 container/tree refs、height 与 onScroll。ResizeObserver 按实际树区域测量虚拟列表高度；Tree.scrollTo 恢复保存位置，元数据响应不会重置滚动。滚动停止 150ms 后提交位置，避免逐帧更新工作区与持久化；卸载取消定时器和观察器，不请求数据库。

节点类型参数 Node extends DataNode 贯通 Tree ref；调用方用同一节点类型约束 Tree 与 titleRender，不依靠类型断言补齐字段。

ready 控制首次位置恢复：已展开连接/库列表及表详情加载前不保存临时裁剪到 0 的位置，虚拟行更新后通过动画帧恢复。后续手动刷新即使暂有分支加载，也可正常滚动和保存。
