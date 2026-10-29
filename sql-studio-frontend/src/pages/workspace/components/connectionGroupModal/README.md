# 连接分组弹窗

`manager: ReturnType<typeof useConnectionGroups>` 提供表单、模式、错误和保存回调。新建/重命名共用 Ant Design Modal 和 horizontal Form，字段为“分组名称”，标签固定 88px。名称去除首尾空格并验证重名，保存中禁用输入和关闭；失败保留输入并展示错误。

dialog.deleting 时显示删除分组确认：名称禁用，右侧帮助说明成员移入默认分组且窗口保留，红色删除按钮调用同一 save。保留横向表单，失败在当前弹窗显示并可重试。

visible 控制显示，afterOpenChange(false) 调用 manager.afterClose 清理内容；保留原表单直至关闭动画结束。新建/重命名打开完成后聚焦并选中名称。
