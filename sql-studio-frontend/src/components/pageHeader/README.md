# PageHeader

Workspace与Agent共用的顶部布局，children为左侧操作，actions为右侧保存状态及主题。统一56px高度、workspace-inset边距、surface背景、border底线及16px右侧间距。仅布局，无状态与请求。

title可选，存在时在顶栏几何中心显示省略文本，不改变左右操作区；workspace不传title保持原布局。

titleOffset?:number默认0，为标题相对顶栏中心的水平偏移。Agent传当前侧栏实际宽度的一半，使标题居中于右侧内容区；不再通过固定116px CSS偏移。
