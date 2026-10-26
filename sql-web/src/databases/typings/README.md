# 数据库能力契约

[源码](index.ts)

DatabaseEngine 为 as const 的类型枚举，DatabaseType 由其值推导，与后端类型字符串保持一致；兼容项目 erasableSyntaxOnly，不引入运行时 TypeScript enum。

DatabaseProfile 约束只读类型、标签、说明、样式类、端口、图标地址。SQLCompletionContext 提供当前 database/table 和库→表→字段 schema。DatabaseAdapter 约束产品配置、分号切分、历史注释清理、限定库表查询生成及补全扩展工厂。

所有方法均不发起数据库请求。参数和返回值见各数据库功能 README；前后端请求响应仍由 typings/database 维护。

- [对象管理契约](objectManagement/README.md)：库表表单、目标范围与引擎能力。

DatabaseAdapter.updateCellSQL 根据显式库表、字段元数据和原结果生成单行更新，拒绝不完整主键或不支持字段。

DatabaseAdapter.insertRowSQL/canInsertColumn 提供新增行的引擎实现。
