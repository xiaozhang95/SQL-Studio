# 删除气泡确认

`DeleteConfirmation(props)` 通过 Ant Design Popconfirm 为删除单条查询收藏、移除模型或表字段草稿提供确认。参数透传 `PopconfirmProps`，确认按钮使用 default 类型。`okText` 默认「删除」，`cancelText` 默认「取消」，均随语言切换。`children` 是接收事件和 ref 的按钮或锚点。

调用方通过 `title` 和 `description` 说明对象范围和影响，并管理 `disabled`、`open`、`onOpenChange`、提交状态和 `onConfirm`。数据行、Redis 键、执行历史和 AI 会话使用 [删除确认弹框](../deleteDialog/README.md)。
