# 目标范围状态更新

`upsertConnection(connections,saved)` 在原位置更新已有连接，新连接追加到末尾，不选择或打开连接。

`queryScopesAfterChange(tabs,change)` 只处理目标连接/库下的 SQL 页：删库清空库表，删表清空表名，重命名更新表名；其余页保留原对象。

`explorerAfterChange(layout,change)` 创建对象时返回原布局；删库/表仅移除目标节点及后代的展开/选中记录，重命名替换该表身份。其他连接、库、搜索与滚动位置保留。均为纯方法，不请求接口、不执行 SQL。
