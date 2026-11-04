# 侧栏宽度拖拽

useSidebarResize(width,onWidthChange,layout,enabled=true)提供panel、visibleWidth、边界、resizing和resizer。layout提供默认/最小/最大宽度、主区最小宽度和键盘步长；工作区与Agent传入各自只读尺寸。拖动使用Pointer Capture，仅结束提交宽度；左右/Home/End调整，双击恢复默认。ResizeObserver限制实际宽度并在卸载断开，持久化由调用方决定。
