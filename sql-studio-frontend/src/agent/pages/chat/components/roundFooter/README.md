# RoundFooter

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

每轮回答底部展示复制、状态、工具操作数和提问时间。entries 为该轮消息，ongoing 表示正在生成。回答包含 SQL 或表格时，显示对应的复制、打开查询和导出操作。导出 Excel 与表格旁共用蓝色主按钮，打开查询通过 [openQuery](../../../../../services/openQuery/README.md) 事件交给工作区。复制保留回答正文，问题编辑位于用户提问下方。有错误记录时，可通过「查看失败原因」展开去重后的错误详情。

与回复正文的间隔由 TurnContent 控制，页脚各行和行内操作使用 CHAT.spacing.detail（8px）。

waiting表示本轮等待用户确认，状态显示「等待确认」。用户拒绝继续时显示「已停止」。
