# 同步数据库

`/sync` 可从工作区顶栏或连接右键菜单进入，接收保存的 `connections`、可选 `initialConnection`、`onCreated(connectionId)` 和共享页面布局参数。连接右键预选该连接为源、采用其数据库类型并读取源库列表。顶栏或无有效连接的直达链接打开空白表单。

源和目标可独立选择同类型的已保存连接或填写外部连接。源库可读取列表，外部源也可手填。通过检查后才能执行，运行时展示实时阶段、表进度、已写入记录及耗时，结束后可查看结果或修改配置。同步期间页面上的工作区按钮禁用；浏览器离开或刷新会中止请求，已创建的目标对象可能保留。

- [同步状态](hooks/useDatabaseSync/README.md)
- [源和目标连接控件](components/databaseSyncConnection/README.md)
- [公共引擎图标](../../components/engineIcon/README.md)
