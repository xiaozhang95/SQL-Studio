# 会话重命名

useSessionRename(onRename)管理selected、横向Form、busy/error与show/close/save。打开填入当前名称，保存trim后调用父hook，失败保留输入并展示错误，成功关闭；busy期间禁止重复保存和关闭。无持久化或直接请求。
