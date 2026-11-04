# 会话局部加载提示

ConversationLoading({label?})展示原生small Spin和单行次要文字，默认“正在加载历史消息”。用于首次读取会话与向上补入历史轮次的边界，不覆盖消息区、不锁定滚动；无请求和状态。role=status提供无焦点抢占的加载说明，文字独立于Spin，避免嵌套加载tip在窄容器中换行。
