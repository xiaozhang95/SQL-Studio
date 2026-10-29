# 数据库能力契约

[源码](index.ts)

DatabaseEngine 为 as const 的类型枚举，DatabaseType 由其值推导，与后端类型字符串保持一致；兼容项目 erasableSyntaxOnly，不引入运行时 TypeScript enum。

DatabaseProfile 约束只读类型、标签、说明、样式类、端口、图标地址。SQLCompletionContext 提供当前 database/table 和库→表→字段 schema。DatabaseAdapter 约束产品配置、分号切分、历史注释清理、限定库表查询生成及补全扩展工厂。

所有方法均不发起数据库请求。参数和返回值见各数据库功能 README；前后端请求响应仍由 typings/database 维护。

- [对象管理契约](objectManagement/README.md)：库表表单、目标范围与引擎能力。

databaseEditor? 独立声明 metadataSQL/definition/sql/Form：只读加载、运行时解码、基于原值生成单语句修改及引擎所属表单。dataDump? 声明 querySQL、可选 metadataSQL 和 dump；外层只负责显式目标读取、取消和下载，菜单按这两项能力展示编辑数据库/结构和数据，不再把它们绑定到 objects。

DatabaseAdapter.updateCellSQL 根据显式库表、字段元数据和原结果生成单行更新，拒绝不完整主键或不支持字段。

DatabaseAdapter.insertRowSQL/canInsertColumn 提供新增行的引擎实现。

DatabaseAdapter.isSQLColumn(name:string):boolean 判断结果列是否明确承载 SQL；结果 UI 据此复用只读高亮与复制，具体列名由引擎维护。

DatabaseAdapter.useDatabase(statement):string|undefined 识别完整切库语句；仅在请求成功后应用返回库名。

DatabaseEngine.PostgreSQL=postgresql。DatabaseProfile.database? 为维护库默认值（MySQL 省略，PostgreSQL 为 postgres）。DatabaseAdapter.objects 可为 undefined，UI 与执行入口均据此限制可视化对象管理；exportDDL(database,table,ddl) 单独负责结构参考导出。

databaseEditor.Form 接收 creating:boolean 和可选 definition:DatabaseDefinition，新建/编辑共用属性行；库名称字段由共享 ObjectManagementForm 注册。引擎组件按实际支持能力禁用属性，新建禁用字段不注册、不校验或提交；数据库 SQL、读取和提交能力保持原契约。

DatabaseProfile.iconPresentation? 可为 brand，指定原始品牌图标使用透明底板与独立状态圆点；省略沿用现有状态底板，具体资源仍由所属引擎 profile 提供。

DatabaseAdapter.explorer? 提供 schema 引擎的 tableIdentity(table):{schema,name}，纯数据树接收该布局契约；省略则沿用 MySQL 数据库直下表/视图层级。

tableLabel(table) 提供带 schema 的可读对象标签；tableListResult(tables,schema?) 提供引擎所属结构列表列/行，PostgreSQL 拆开 Schema 和表名列。SQLCompletionContext.namespace? 表示当前 schema，schema 字段仍是元数据 map。DatabaseExplorerAdapter.referencedTables? 根据所属方言识别 AI 上下文引用。

当前展示按用户要求统一为绿色圆角底板与白色图形，MySQL 和 PostgreSQL 均使用此样式；未连接的 icon 使用灰色底板。SVG 保留源文件，通过图片 filter 显示白色，悬停和选中不改变图形颜色。此展示替代先前的品牌原色、白色衬底和状态小圆点方案。

DatabaseAdapter.dumpFile 提供 metadataSQL?/header(database,schemas,metadata?)/footer/prepare(database,table,ddl,columns,metadata,withData)。prepare 返回 DumpPlan(before/after/constraints?/data(chunk))，允许工作区先写所有结构、逐批数据、再补外键。deleteRowSQL 根据完整主键生成单行删除，缺少或不支持的主键直接拒绝。

DatabaseEngine.MariaDB=mariadb，注册表必须提供独立 DatabaseAdapter；兼容协议能力可以显式组合，MariaDB 配置、方言与元数据差异由 mariadb 模块拥有。
