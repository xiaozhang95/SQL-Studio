# 写入与继续确认卡片

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

确认提交失败在页面顶栏下方展示。

`WriteConfirmation({value, submitting, onDecide})` 在当前回复下方展示受控的 Ant Design 小号卡片。`value` 为 ConfirmationRequest，`submitting` 为提交状态，`onDecide(allow)` 返回 Promise。写入确认展示目标、对象和完整 SQL。继续确认展示提示，按类型提供继续、压缩后继续、返回编辑或停止本轮。提交期间禁用按钮。

卡片内提示、目标明细、SQL 和操作区统一使用 CHAT.spacing.block（16px），按钮组使用 detail（8px）。

卡片外框复用公共 ContentCard，尺寸与代码预览一致。

常规操作按钮使用 Ant Design default 类型，保留原生悬停、按下、焦点和禁用反馈，不增加交互颜色覆盖。
