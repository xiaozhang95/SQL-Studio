# 转储可用状态

`canExportDatabase(snapshot,closed,database)` 仅在连接已打开、目标库表列表成功加载且没有加载中/错误/显式关闭状态时返回 true。名称列表不代表打开数据库；成功加载空数组的空库允许导出。对象树菜单与 useDataExport 调用入口共用此规则，防止过期菜单绕过检查，不请求数据库或修改展开状态。

`databaseOpenState(snapshot,closed,database)` 返回 closed/opening/open/error，供数据库节点图标、悬停说明和转储门禁共用。打开连接并列出库名不会自动打开每个库；成功加载空库同样是 open。折叠不等于关闭，显式关闭或父连接不可用时为 closed。
