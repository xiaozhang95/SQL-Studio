# 对象管理契约

[源码](index.ts) · [父级数据库契约](../README.md)

ObjectAction 是只读操作常量。ObjectTarget 必须显式携带 connectionId/database/table，可选 view 区分视图。ObjectFormValues 保存名称、字符集/排序规则、字段数组和危险操作确认文本。FieldDefinition 包含原始字段名、类型、空值、主键、自增、默认值模式、注释、原字符集/排序规则及额外属性；locked 表示只能原样保留的特殊字段。

DatabaseObjectAdapter 由引擎实现，提供只读元数据 SQL、结果解码、字段初始化、单语句生成与结构转储。新建/编辑库只改库默认字符集/排序规则；表设计只生成差异 ALTER，不重建表，不删除其他索引。字段与默认值校验由引擎负责，HTTP 与可变 UI 状态不进入该契约。

dumpData(database,table,result,columns) 将未截断结果转换为可导入的数据语句。

defaultCollation(options)、initialFields() 和 dumpWithData(database,table,ddl,result,columns) 将引擎默认字段、排序规则选择与数据转储会话包装留在引擎内，工作区只组合调用。
