# 删除确认弹框

`DeleteDialog` 是删除和清空操作用的受控弹框。调用方提供 `open`、`title`、正文、`onCancel` 和 `onConfirm`，管理目标、错误和请求状态。`confirmText` 默认「删除」，也可传入「清空」等已翻译文案。`busy` 锁定提交和关闭，`disabled` 禁用确认。`resultOnly` 只提供「关闭」，用于不能立即重试的删除结果。长目标名或错误可在正文换行并滚动。
