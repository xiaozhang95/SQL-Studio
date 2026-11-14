# Redis 终端

接收页签 ID、连接 ID、逻辑库编号和可见状态。按 Enter 执行，方向键上下检索历史。输入 `clear` 或按 Ctrl/Command+L 清屏。通过[终端会话](../../utils/terminalSession/README.md)恢复输入、历史和已完成回执。

成功的 SELECT 通过 `onDatabase` 传回发起标签。执行期间 `onBusy` 暂停该页范围切换，卸载取消在途请求。
