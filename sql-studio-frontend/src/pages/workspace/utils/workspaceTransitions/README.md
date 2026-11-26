# 目标范围状态更新

`upsertConnection(connections,saved)` 在原位置更新已有连接，新连接追加到末尾，不选择或打开连接。

`explorerAfterDatabasesLoaded(layout,connectionId,databases)` 有效请求返回库列表后调用，也可传空列表显式重置连接下的所有分支，删除目标连接下已不存在数据库及全部后代的展开、选中记录；保留连接/分组、其他库与连接、搜索及滚动位置。无变更返回原对象。空列表确认成功时同样清理；已失效的请求不得更新布局。同名库重新出现时不会继承已删除分支的展开记录。

`findExplorerPage(tabs,kind,connectionId,database,table,schema?)` 按完整范围及页面类型查找已有对象页，不匹配 SQL 或设计页。

`queryScopesAfterChange(tabs,change)` 在表重命名时更新目标连接、库和表绑定的 SQL 页范围。`pagesForObjectDrop(tabs,action,target)` 返回对象树删库或删表所涉及的标签页。删库匹配连接和数据库，删表再匹配表身份及已记录的 Schema。调用方用同一范围处理删除前的草稿确认及成功后的页面移除。

`pagesAfterSchemaChange(tabs,change,layout)` 将重命名 Schema 的页面范围和完整表身份更新，保留 SQL 原文与结果快照；删除 Schema 只清空相关查询范围。旧 Schema 树分支在刷新后清理，不影响其他连接和库。

`explorerAfterChange(layout,change)` 创建对象时返回原布局；删库/表仅移除目标节点及后代的展开/选中记录，重命名替换该表身份。其他连接、库、搜索与滚动位置保留。均为纯方法，不请求接口、不执行 SQL。

`explorerForOpenedConnections(layout, openedConnections)` 在写入和读取工作区索引时保留分组及已打开连接各层级的展开和选中记录，过滤无效节点键和未打开连接的记录。
