# Transcript

受控entries/busy/status/expanded/onExpanded；用户消息靠右，思考与执行共用带官方蓝鲸的ProcessCard，支持折叠和单独隐藏。隐藏后“显示过程”恢复全部过程卡片；所有查询结果始终在过程卡片外展示，隐藏执行过程不隐藏查询数据。Typography继承Ant Design默认字号，文本保留换行并安全显示。useTranscriptScroll只在接近末尾时跟随，用户上滚时保留阅读位置。无网络请求。

官方思考与回答分区，未完成片段明确标识。展开键thinking-ID/tools-ID及隐藏键hidden-thinking-ID/hidden-tools-ID一起保存在Go布局expanded中；刷新恢复，不删除记录。恢复重用相同事件折叠逻辑，不伪造思考内容。
