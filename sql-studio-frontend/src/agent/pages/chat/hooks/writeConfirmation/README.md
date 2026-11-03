# useWriteConfirmation

接收live SSE write_confirmation事件并显示逐次执行确认。弹窗包含连接、库、涉及对象和SQL只读高亮，确认/取消调用同源POST /api/agent/write-confirmation，一次性approvalId绑定后端当前工具。请求失败留在弹窗；取消不执行且后端终止本轮；中止、超时、卸载销毁弹窗，不能恢复旧记录重新确认。不发起真实SQL，仅提交用户决定。
