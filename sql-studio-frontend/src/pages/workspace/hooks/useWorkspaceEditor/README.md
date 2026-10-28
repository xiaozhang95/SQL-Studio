# 工作区编辑会话

useWorkspaceEditor({layouts,commit}) 独立管理当前 CodeMirror EditorView 和页面归属，返回 editor、pending、attach/detach、update/remember、read/flush/discard。update 从 ViewUpdate 捕获不可变文档与选区；remember 捕获滚动。布局相同不提交，SQL 每250ms最多展开一次，位置变化不展开全文。commit 接收 id/sql?/layout?，调用者只更新仍存在的目标页面。

attach(id,view) 恢复对应位置，异步滚动回调验证同一实例；detach(view?) 核对实例后先提交最新内容并解除引用。read(id,fallback) 始终读取该页当前编辑文本；没有对应实例才回退。运行、导出、切页、范围关闭先flush；关闭页discard并以closedPages阻止迟到提交。失焦/pagehide同步缓冲至React，但浏览器退出时异步磁盘请求仍不保证完成，保存状态成功才表示已落盘。

SQL由CodeMirror持有，React中的草稿是批量同步快照。pending仅在批次开始/结束变化并进入顶部保存状态；没有逐字全文state更新。卸载清理计时器，不保留其他页面全文缓存。
