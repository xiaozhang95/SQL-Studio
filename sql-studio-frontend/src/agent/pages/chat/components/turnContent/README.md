# TurnContent

渲染单轮entries及错误和底部操作，busy/status为本轮生成状态，locked禁用所有轮次编辑；expanded/onExpanded受控折叠状态，onEdit回填问题。保留工具参数、API对应地址、结果表格、复制及发送时间。结果仅在执行过程内部，错误属于该轮底部。虚拟列表卸载后由外部expanded恢复折叠，无自身滚动和自动请求。
