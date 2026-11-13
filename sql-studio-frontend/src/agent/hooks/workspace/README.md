# useWorkspace

初始化读取 Go 布局，返回 state、ready、saving、update、applyLatest 和 epoch。加载失败时以本次会话默认布局继续使用，窗口重新聚焦后尝试读取。保存采用 400ms 防抖和单请求串行。409 后读取最新布局并暂停提交旧草稿，ChatPage 在会话空闲时调用 applyLatest，借助 epoch 重新初始化当前会话及草稿。pagehide 或卸载时尽力保存。
