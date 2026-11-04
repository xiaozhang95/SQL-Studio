# useRoundTranscript

useRoundTranscript(rounds, attention=false, live=false)管理单轮消息视口，一次只提供一个round，默认最近一轮。viewport/content为DOM ref；activeIndex为当前或待加载轮次，loading表示切换中；jump(index,alignment='start')、previous、next、toLatest提供导航，onScroll更新阅读及末尾跟随状态。切换立即卸载旧轮，等待CHAT.roundSwitch.loadingDelay后展示新轮；仅操作已读取的本地事件，无网络请求、模型调用或SQL执行。

用户通过上一轮、下一轮、刻度或问题列表手动切换。滚轮、触摸和方向键用于当前轮的原生滚动。

最新轮且读到末尾时跟随内容与ResizeObserver高度变化；上滚阅读后保持位置。live用于初次挂载正在生成的轮次；新提问立即展示最新轮；attention从false变true时回到最新回复末尾以展示写入确认，等待期间仍可阅读历史。切换期间的新目标替换旧计时，新增提问取消待切换；组件按会话ID重建，卸载清理计时、观察器及DOM监听，不保留其他会话或轮次的DOM。
