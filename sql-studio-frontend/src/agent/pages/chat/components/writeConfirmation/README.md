# 写入与继续确认卡片

确认提交失败通过卡片内的共享 ErrorNotice 展示。

WriteConfirmation({value:ConfirmationRequest,submitting:boolean,error:string,onDecide:(allow:boolean)=>Promise<void>})在当前回复下方展示受控的 Ant Design 小号卡片。写入确认展示目标、对象和完整 SQL。继续确认展示输入、结果、上下文或读取失败提示，按类型提供继续、压缩后继续、返回编辑或停止本轮。提交期间禁用按钮，失败信息留在卡片内。

卡片内提示、目标明细、SQL、错误和操作区统一使用CHAT.spacing.block（16px），按钮组使用detail（8px）；CodeBlock不叠加外边距。

卡片外框复用公共 ContentCard，尺寸与代码预览一致。

常规操作按钮使用 Ant Design default 类型，保留原生悬停、按下、焦点和禁用反馈，不增加交互颜色覆盖。
