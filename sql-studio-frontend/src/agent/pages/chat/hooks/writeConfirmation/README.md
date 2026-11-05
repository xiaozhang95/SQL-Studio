# useWriteConfirmation

接收实时 write_confirmation 和 continue_confirmation 事件，校验对应明细并向各自端点提交一次性决定。返回pending（ConfirmationRequest或null）、submitting、error，以及show(value:unknown,signal:AbortSignal,continuation=false)、decide(allow:boolean)、close()。show校验明细并替换当前待确认请求；ChatPage通过WriteConfirmation将连接、库、对象和SQL显示为当前回复下方的卡片，不弹窗。

decide调用同源POST /api/agent/write-confirmation，一次性approvalId绑定后端当前工具；提交期间以ref锁定，阻止重复确认或确认/取消并发。请求失败显示卡片内错误并允许手动重试；取消不执行且后端终止本轮。中止、超时、流结束清空卡片，卸载释放监听，迟到响应不能清除新确认卡片。历史不恢复确认，不自动提交或重试，不直接执行SQL。

继续确认仅接受 input/result/context 三种用途，不再接受后端不会发送的 recovery 分支。
