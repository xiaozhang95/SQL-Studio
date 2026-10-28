# 数据库属性表单

默认导出 DatabasePropertiesForm({definition:DatabaseDefinition})。在宿主 Form 内注册 owner、connectionLimit、comment，初值、校验、禁用状态、变更回调、预览和提交由宿主 useObjectManagement 控制。

库名、编码、排序规则、字符分类只读；所有者输入角色原名，连接数范围 -1 至 2147483647，注释允许清空。使用 Ant Design 默认控件与布局，无请求、缓存或写入。
