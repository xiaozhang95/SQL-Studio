# 对象树数据构建

`buildExplorerTree(connections,snapshots,expanded,search)` 返回 nodes、loadedKeys、expandedKeys 与 byKey。仅构建已展开层级的纯数据，折叠分支不创建字段/索引节点，不生成 React 元素或菜单。titleRender 只渲染可见节点，右键时才创建菜单。

`explorerQueryScope(node,connected,layout?)` 从已连接的连接节点提取连接，或从数据库及下级可见节点提取连接、库及 schema；无有效目标返回 undefined，表不作为查询预选项。

所有身份包含原始连接/库/表/字段，搜索匹配分组、连接和已加载库表。方法不修改传入数据或已保存的展开状态；expandedKeys 只过滤当前树有效节点，原展开记录由工作区保留。缓存元数据仍由 useDatabaseObjects 管理。

第七参数 closedDatabases 传入各连接显式关闭的库名；数据库节点 databaseState 使用共享 databaseOpenState，包含未打开、正在打开、已打开、打开失败。状态来自该库元数据生命周期，独立于父连接与折叠状态；tooltip 展示状态及实际错误。仅列出库名时默认未打开，成功加载空库同样已打开。

索引节点接受 primary? 主键标志，不以 PostgreSQL 实际索引名推断主键；schema/table 完整身份由元数据原样传递。

第五参数 layouts 按 connectionId 提供可选 DatabaseExplorerAdapter。带布局的连接使用 snapshots.schemas 的真实 schema 列表与已加载表分组，空 schema 仍保留；schema 与类别 key 包含 schema，表 key 保留原完整身份。仅展开 schema/类别创建下级节点，搜索支持空 schema 名称。无布局引擎保持原层次。
