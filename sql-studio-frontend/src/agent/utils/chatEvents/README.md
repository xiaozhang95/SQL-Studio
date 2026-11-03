# applyEvent

applyEvent(entries,event)为纯不可变事件折叠器，实时SSE与本地恢复共同使用。区分思考/回答增量，最终answer替换增量避免重复；工具结果合并步骤；error保留未完成片段并标识。model_start隔离工具轮次，turn_end/done结束流式状态。不执行任何SQL或请求。
