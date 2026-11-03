# useVirtualTranscript

管理Virtuoso引用、当前可视轮次、末尾跟随及跳转。新问题回到末尾，用户上滚后不随流式输出拉回；ResizeObserver由虚拟列表管理动态高度，支持折叠和表格尺寸变化。jump按轮次定位；toLatest恢复跟随。组件按会话ID重建，引用、帧回调随组件清理，无网络和持久化。
