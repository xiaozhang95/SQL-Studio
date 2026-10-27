# 对象栏宽度交互

[源码](index.ts)

useSidebarResize(width, onWidthChange) 接收工作区保存的偏好宽度，返回 panel ref、visibleWidth、minimumWidth/maximumWidth、resizing 及 resizer 事件处理器。connectionSidebar 负责渲染 separator 与 aria 属性。

默认宽度 272px，范围 200–560px，并随工作区宽度收紧上限，为主区域至少保留 520px；ResizeObserver 在窗口变化后重新计算实际展示宽度，偏好值保留，卸载断开观察。

主指针拖动使用 Pointer Capture，支持移出分隔条继续拖动、抬起/取消/丢失捕获结束。拖动期间只更新临时预览，结束才调用 onWidthChange，避免每个像素都触发完整工作区的加密保存。键盘左右键每次调整 24px，Home/End 到边界，双击重置 272px；不更改连接、查询范围或树选中状态。

enabled?:boolean默认true，父工作区在恢复完成后启用尺寸监听。Workspace统一调用并把同一layout返回值传入ConnectionSidebar；visibleWidth同时用于顶栏分区，拖动预览、窗口限宽和持久化宽度不会出现两套计算。
