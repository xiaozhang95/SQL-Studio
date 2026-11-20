# 删除键确认弹框

`KeyDelete({ item?, saving, disabled?, error, onConfirm, onCancel })` 复用 [DeleteDialog](../../../../../../components/deleteDialog/README.md)，供键树菜单和键详情的删除按钮共用。`item` 包含完整键名和原始引用，有目标时打开。`saving` 锁定提交和关闭，`disabled` 由父级指定。失败时通过 `error` 显示原因。

父级通过 `onConfirm` 提交指定键，成功后清除目标，通过 `onCancel` 关闭弹框。新建确认时清除上次错误。
