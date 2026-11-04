# applyEvent

applyEvent(entries,event)为纯不可变事件折叠器，实时SSE与本地恢复共同使用。区分思考/回答增量，最终answer替换增量避免重复；工具结果合并步骤；error保留未完成片段并标识，以独立error角色保存。chatErrors(entries)提取并去重流式与工具失败消息，供页面头部展示。model_start隔离工具轮次，turn_end/done结束流式状态。不执行任何SQL或请求。

restoreEvents(events,signal) 使用同一折叠语义，私有可变累加器只处理新增事件；流式消息集合和待完成工具索引避免反复复制/扫描已有消息。每256个事件让出主线程并检查取消，结束前再次检查；取消抛AbortError，不返回部分历史。applyEvent仍保持输入不可变。历史恢复不执行模型或SQL。
