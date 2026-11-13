# 数据库实现

[统一入口](index.ts) · [契约与类型枚举](typings/README.md) · [MySQL](mysql/README.md)

getDatabaseAdapter(type?) 接收 DatabaseType，省略时使用 MySQL，返回 DatabaseAdapter。入口仅按类型分派实际实现，注册表通过 satisfies Record<DatabaseType, DatabaseAdapter> 做穷尽校验。

页面、组件和 hooks 通过适配器获取 profile、completion、splitStatements、cleanHistory 和 tableDataSQL。MySQL、MariaDB、PostgreSQL 和 GreptimeDB 各自在本目录维护品牌、端口、方言及专属 SQL。

HTTP 仍统一通过 services/database 请求后端，数据库模块不保管凭据、不发起网络请求，不扩大只读权限。数据库间存在实际不同的请求/表单/组件时，将实现放到对应数据库目录并经此入口暴露。

- [PostgreSQL](postgresql/README.md)：独立配置、脚本、补全、schema 查询与数据编辑。

databaseProfiles 导出已实现引擎 profile 列表。objects 可为 undefined 表示没有可视化库表管理能力，exportDDL 独立提供结构参考导出；不得用其他引擎实现补齐缺失能力。

- [MariaDB](mariadb/README.md)：独立类型、MariaSQL 补全、默认值及排序规则适配，显式复用 MySQL 协议通用能力。
- [GreptimeDB](greptimedb/README.md)：独立连接配置、语句切分与库表浏览。
