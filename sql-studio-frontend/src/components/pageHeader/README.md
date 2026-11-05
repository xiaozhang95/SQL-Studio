# PageHeader

工作区与 AI 助手共用的顶部布局，children 包含左侧操作和页面入口，actions 包含右侧保存状态和「系统设置」下拉按钮。浏览器和 Electron 的业务 header 均保留 56px 高度，沿用 workspace-inset 边距、surface 背景和 border 底线；窄屏控件可换行，右侧控件保持右对齐。仅负责布局。

Electron 中在业务 header 前组合 [DesktopTitleBar](../desktopTitleBar/README.md)，标题栏和 header 使用相同 surface 背景并随亮暗主题同步；普通浏览器不增加额外行。调用方容器需沿用纵向 flex 布局。

title/titleClassName/titleOffset 为业务 header 的可选中心标题、样式类和水平偏移，默认偏移 0；通过 ResizeObserver 限制标题宽度，卸载时清理。AI 助手继续显示会话标题，并以侧栏宽度的一半作为偏移。

showDesktopTitle?: boolean 默认 true，只控制 Electron 最上方的 SQL Studio 应用名。AI 助手传 false；它与业务 header 的会话标题是两个独立区域。

desktopTitle?: string 为 Electron 最上方的标题，缺省 SQL Studio；desktopActive?: boolean 默认 true，控制是否由当前页面同步系统窗口标题。工作台传活动页派生标题及自身 active 状态；AI 页隐藏此标题，业务 header 的会话标题独立显示。
