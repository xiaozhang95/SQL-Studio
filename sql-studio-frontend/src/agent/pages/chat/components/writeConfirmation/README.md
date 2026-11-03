# 写入确认卡片

WriteConfirmation({value:WriteConfirmationRequest,submitting:boolean,error:string,onDecide:(allow:boolean)=>Promise<void>})是受控展示组件，在当前回复下方显示Ant Design small Card。展示目标连接、数据库、对象、不可撤销提示和完整只读SQL（高亮、可复制）。确认/取消回调分别传true/false；提交期间禁用双按钮，错误留在卡片内。组件无请求、持久化或自动确认行为，生命周期由useWriteConfirmation管理。

卡片内提示、目标明细、SQL、错误和操作区统一使用CHAT.spacing.block（16px），按钮组使用detail（8px）；CodeBlock不叠加外边距。
