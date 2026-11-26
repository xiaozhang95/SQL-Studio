# 对象树会话暂存

`rememberExplorer(current,saved,inFlight)` 仅暂存未提交的展开、选中节点键和已打开连接 ID，处理点击后立刻刷新页面的情况。通常的工作区保存仍负责落盘。`restoreExplorer(saved,revision)` 只接受当前基线修订，或本窗口恰好已提交的在途树状态。写入完成后清理已落盘的暂存，保存冲突时调用 `clearExplorerSession()` 丢弃本地暂存并重新读取服务端状态。
