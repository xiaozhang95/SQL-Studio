# RoundFooter

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

每轮回答底部的复制、状态、工具操作数及提问时间。entries 为该轮消息，ongoing 表示正在生成。回答包含 SQL 或表格时，先显示「复制 SQL」「在查询页打开」「导出 Excel」三个 26px 文本操作；打开查询通过 [openQuery](../../../../../services/openQuery/README.md) 事件交给工作区。复制保留回答正文，问题编辑位于用户气泡下方。该轮有错误记录时，可在底部通过「查看失败原因」展开去重后的错误详情。

不设置额外上下padding，距回复内容的间隔由TurnContent统一控制；内部横向使用CHAT.spacing.detail（8px）。

waiting表示本轮等待用户确认，状态显示「等待确认」。用户拒绝继续时显示「已停止」。
