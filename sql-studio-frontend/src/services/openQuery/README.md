# Open query

`requestOpenQuery(sql)` 通过 `sql-studio:open-query` 自定义事件请求工作区打开查询；`subscribeOpenQuery(handler)` 在工作区外壳订阅该请求并返回取消订阅函数。空 SQL 不触发。Agent 的代码卡片和回答操作使用它实现「在查询页打开」，事件只在当前窗口内传递，不写入持久化状态。

工作台创建未绑定连接的查询草稿。导航锁定或工作台暂时无法创建页签时保留当前页面。
