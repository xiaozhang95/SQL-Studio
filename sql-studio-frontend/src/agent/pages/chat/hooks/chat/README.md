# 会话生命周期

useChat(workspace)管理Form、SSE、历史列表与创建/删除/重命名。初始化先ensureHistory，空列表由后端原子创建默认会话，优先恢复activeId，否则选中首条，再只读加载事件。createNew立即创建、刷新索引并选中，不等待首条消息。删除当前会话选中剩余首条，删除最后一条自动确保新的默认会话；删除其他会话保留当前内容和草稿。

renameHistory只替换索引信息，不改变当前消息/草稿/展开状态；服务端保存手动命名。mutation ref阻止重复点击，historyVersion丢弃跨变更的旧列表响应。错误显示并保留已有内容，创建/选择/删除/重命名期间禁止重复变更；卸载取消流和初始化请求，StrictMode不会重复创建默认项。

恢复不执行模型或SQL；SSE经applyEvent还原，取消保留已输出片段。草稿与展开状态交给workspace保存，历史折叠抽屉由historyOpen控制。

editQuestion(text)将已有问题回填当前输入框、同步本机草稿并聚焦；执行或管理会话中不回填。由用户修改并再次发送，不改写原问题。

写入逐次确认：execute_write通过write_confirmation SSE事件暂停，携带approvalId/connection/database/objects/sql。POST /api/agent/write-confirmation提交allow，确认ID不可重复使用；未确认、取消、超时、断开不执行，取消结束本轮。服务端生成明细并绑定本次目标/SQL，不接收前端替换SQL。等待仍受本轮总超时约束；恢复历史不重新显示已过期确认卡片。模式提示不替代逐次确认。

useChat.confirmWrite公开当前待确认明细、提交状态、错误及决策回调，页面将其组合为最后一轮回复下方的确认卡片；等待时status显示“等待确认数据库操作”，不再发起执行确认弹窗。
