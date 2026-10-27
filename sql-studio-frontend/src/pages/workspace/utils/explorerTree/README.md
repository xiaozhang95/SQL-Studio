# 对象树数据构建

`buildExplorerTree(connections,snapshots,expanded,search)` 返回 nodes、loadedKeys、expandedKeys 与 byKey。仅构建已展开层级的纯数据，折叠分支不创建字段/索引节点，不生成 React 元素或菜单。titleRender 只渲染可见节点，右键时才创建菜单。

所有身份包含原始连接/库/表/字段，搜索匹配分组、连接和已加载库表。方法不修改传入数据或已保存的展开状态；expandedKeys 只过滤当前树有效节点，原展开记录由工作区保留。缓存元数据仍由 useDatabaseObjects 管理。
