# useWriteConfirmation

接收实时 write_confirmation 和 continue_confirmation 事件，校验对应明细并向各自端点提交一次性决定。返回pending（ConfirmationRequest或null）、submitting、error，以及show(value:unknown,signal:AbortSignal,continuation=false)、decide(allow:boolean)、close()。show校验明细并替换当前待确认请求；ChatPage通过WriteConfirmation将连接、库、对象和SQL显示为当前回复下方的卡片，不弹窗。

decide 通过全局 request 工具调用同源 POST /api/agent/write-confirmation，一次性 approvalId 绑定后端当前工具。提交期间以 ref 锁定，阻止重复决定或确认与取消并发。失败通过卡片内的 ErrorNotice 展示，并允许手动重试。取消后后端终止本轮。中止、超时、流结束清空卡片，卸载释放监听，迟到响应不能清除新确认。

继续确认仅接受 input/result/context 三种用途，不再接受后端不会发送的 recovery 分支。
