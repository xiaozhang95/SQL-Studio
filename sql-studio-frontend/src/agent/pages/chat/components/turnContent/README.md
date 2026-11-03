# TurnContent

渲染单轮entries及错误和回答底部复制/状态，busy/status为本轮生成状态，locked禁用所有用户问题编辑；expanded/onExpanded受控折叠状态，onEdit回填问题。保留工具参数、API对应地址、结果表格、复制及发送时间。结果仅在执行过程内部，错误属于该轮底部。虚拟列表卸载后由外部expanded恢复折叠，无自身滚动和自动请求。

助手Bubble的root/body/content均满宽，避免表格按内容宽度收缩；用户气泡继续靠右并自适应。

统一使用CHAT.spacing：问题/过程/回答/错误/底部状态等内容块之间为block（16px），问题气泡与操作、工具名称/API/参数等同组详情之间为detail（8px）。执行步骤改用满宽Flex，步骤元数据与结果、相邻步骤统一16px；用户问题分隔线不再叠加默认margin。正文与卡片均保持满宽和相同左边线。
