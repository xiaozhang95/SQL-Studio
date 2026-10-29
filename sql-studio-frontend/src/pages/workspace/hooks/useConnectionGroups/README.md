# 连接分组管理

`useConnectionGroups({ groups, blocked, onGroupsChanged, onRenamed, onMoved })` 管理新建、重命名的横向表单及连接移动请求，返回 form、dialog、saving、error 与 open/close/save/move。

groups 由工作区统一加载，包含空分组；新建和重命名成功更新同一份列表，连接弹窗同步消费。重名、空名称和请求错误在弹窗展示；默认分组为内置回退项，不允许重命名。操作期间防止重复提交；blocked 时禁止打开或提交，保存期间禁止关闭。

移动只调用专用 group API 并回传脱敏连接，不走连接编辑流程、不更改查询范围或会话。失败使用带详情的错误弹窗，保留原归属。重命名成功回报旧名/新名，工作区据此更新连接及分组展开 key；连接 ID 和对象缓存保持不变。
