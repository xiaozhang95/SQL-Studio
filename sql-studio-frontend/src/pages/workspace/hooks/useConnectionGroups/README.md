# 连接分组管理

`useConnectionGroups({ groups, blocked, onGroupsChanged, onRenamed, onMoved })` 管理新建、重命名的横向表单及连接移动请求，返回 form、dialog、saving、error 与 open/close/save/move。

groups 由工作区统一加载，包含空分组；新建和重命名成功更新同一份列表，连接弹窗同步消费。重名、空名称和请求错误在弹窗展示；默认分组为内置回退项，不允许重命名。操作期间防止重复提交；blocked 时禁止打开或提交，保存期间禁止关闭。

移动调用专用 group API 并回传脱敏连接。失败通过 moveError 返回，由工作区的 PageHeader 展示，并提供 clearMoveError 清理状态。重命名成功回报旧名和新名，工作区据此更新连接及分组展开 key。

remove(name) 打开删除确认，dialog.deleting=true。save 在删除成功后回传 onGroupsChanged 与 onDeleted(name)，错误保留原列表和弹窗；默认分组不能删除。此过程与新建、重命名共用 saving/pending 锁，不操作连接会话。

visible 独立控制弹窗开关；关闭先隐藏，afterClose 才清理 dialog，避免重命名/删除内容在离场期间跳回新建表单。离场期间仍保持 dialog 锁，不启动新操作。
