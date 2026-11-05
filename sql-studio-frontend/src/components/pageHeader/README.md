# PageHeader

工作区与 AI 助手共用的顶部布局，children 包含左侧操作和页面入口，actions 包含右侧保存状态和「系统设置」下拉按钮。默认高度为 56px，沿用 workspace-inset 边距、surface 背景和 border 底线。窄屏控件可换行，右侧控件保持右对齐。仅负责布局。

title 可选，在顶栏中心加 titleOffset 的位置显示。根据两侧操作区的实测边界限制标题宽度，留出顶栏间距并省略长文本。尺寸观察随标题卸载清理。

titleOffset?:number默认0，为标题相对顶栏中心的水平偏移。Agent传当前侧栏实际宽度的一半，使标题居中于右侧内容区；不再通过固定116px CSS偏移。
