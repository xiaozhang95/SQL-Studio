# 输入区高度拖拽

useComposerResize()返回container、height（默认undefined自动行高）、minimum/maximum和resizer。输入框顶部拖动向上增高、向下缩小，使用Pointer Capture；取消/丢失捕获结束拖动。键盘上下调整24px、Home/End到边界，双击恢复自动行高。ResizeObserver按会话区高度限制上限，预留聊天空间；卸载断开。高度仅保留在当前组件，不持久化、不修改草稿/请求状态。
