# 删除键气泡确认

`KeyDelete({item,saving,disabled?,error,onDelete,onClearError,children})` 组合全局 [DeleteConfirmation](../../../../../../components/deleteConfirmation/README.md)，供 Redis 详情删除按钮使用。item 绑定完整键名及原始引用，onDelete 返回异步成功标记；失败保留气泡和错误，成功关闭，children 是确认锚点。

点击锚点打开并清除旧错误，saving 时锁定确认和取消，disabled 默认 false。不访问 Redis、不持久化状态。键树右键删除由 [KeyTree](../keyTree/README.md) 的 Modal 确认，不使用气泡或隐藏坐标锚点。
