# 数据库对象树

[组件索引](../README.md) · [源码](index.tsx)

## 参数与回调

connectionId、database、selectedTable、selectedSchema、databases、tables、loadTables、loading、error、disabled、onSelect、onRefresh。onSelect(database, table?, schema?)。

## 行为与边界

不重复发起列表请求。搜索仅匹配已加载的表；树 key 包含库/表/Schema；节点名称省略时悬停可查看完整值。标题和节点不显示数量标签，刷新经 onRefresh 回传。

页面私有组件从 `./components/databaseExplorer` 导入；只服务工作区，不通过聚合出口扩散依赖。

## 当前交互

表与视图支持右键菜单：新建查询、查询数据、查询结构、查看 DDL。菜单携带原始数据库/表/Schema，不从展示文字推断，也不依赖先点击选中。执行时禁止菜单操作。普通选择只修改范围，不自动切换底部结构面板。

## 布局修正

选中节点 hover/focus 的局部规则包含树行层级，优先于 Ant Design 原生 nodeHoverColor 规则；只限定选中节点，普通未选中节点保留组件交互。实际数据库/表 hover 均保持白字。
