# 查询收藏状态

`useQueryFavorites()` 持有工作区收藏列表、命名弹窗及串行读写状态。打开收藏时从服务端刷新，读取错误通过 `error` 返回给抽屉，新增和重命名错误通过 `editError` 返回给命名弹窗。 `setDeleteOpen(id, visible)` 绑定或清理当前删除目标，`remove(id)` 仅处理当前确认的收藏。删除失败由确认气泡显示 `deleteError`，保留收藏和确认状态供用户重试。删除成功或关闭抽屉后释放确认目标。
