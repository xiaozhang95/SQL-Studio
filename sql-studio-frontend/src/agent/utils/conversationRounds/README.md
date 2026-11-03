# conversationRounds

conversationRounds(entries)按user事件分轮，保持顺序、消息ID和错误归属，生成最多160字符的助手回答摘要；不将思考当摘要，不改写原数据。roundMarkers(count,active,limit=24)生成最多24个均匀导航刻度，包含首尾与当前轮。完整问题列表仍保留全部轮次。
