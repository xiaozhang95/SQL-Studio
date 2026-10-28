# 目标范围状态更新

`upsertConnection(connections,saved)` 在原位置更新已有连接，新连接追加到末尾，不选择或打开连接。

`findExplorerPage(tabs,kind,connectionId,database,table,schema?)` 按完整范围及页面类型查找已有对象页，不匹配 SQL 或设计页。

`queryScopesAfterChange(tabs,change)` 只处理目标连接/库下的 SQL 页：删库清空库表，删表清空表名，重命名更新表名；其余页保留原对象。

`pagesAfterSchemaChange(tabs,change,layout)` 将重命名 Schema 的页面范围和完整表身份更新，保留 SQL 原文与结果快照；删除 Schema 只清空相关查询范围。旧 Schema 树分支在刷新后清理，不影响其他连接和库。

`explorerAfterChange(layout,change)` 创建对象时返回原布局；删库/表仅移除目标节点及后代的展开/选中记录，重命名替换该表身份。其他连接、库、搜索与滚动位置保留。均为纯方法，不请求接口、不执行 SQL。
