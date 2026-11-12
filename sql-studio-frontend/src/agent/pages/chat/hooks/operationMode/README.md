# useOperationMode

当前页面操作模式，默认readonly；切换均通过AntApp确认风险，确认后生效。write允许受约束新增修改，任何模式禁止删除。busy由调用方禁用选择，模式不持久化，刷新和往返工作台恢复上次确认的模式，每次请求携带模式，不改变正在执行的请求。

用户模式名称为只读模式/完全访问模式；完全访问含非删除结构操作，任何删除均仅提供命令及风险，不执行。

模式唯一状态源为workspace.state.mode，不维护组件私有副本；确认后workspace.update保存，恢复前不允许切换。当前布局必须明确包含 mode；仅首次初始化时采用 readonly。

模式切换弹窗使用CHAT.modeConfirmationWidth（720px），位置沿用Ant Design默认值，窄屏沿用Modal原生视口宽度限制。完全访问提示使用默认弹窗边框、warning Alert、分段权限/逐次确认说明、删除禁令和原生danger确认按钮；只读提示使用info Alert。字体和控件尺寸沿用Ant Design默认层级，仅确认后更新模式；不改变回复下方的逐次执行确认卡片。
模式确认框沿用Ant Design默认位置，不设置centered或会话区偏移。
