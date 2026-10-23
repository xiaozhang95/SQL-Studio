# SQL 标识符

[源码](index.ts)

identifier(name, postgres?)：按协议对库/Schema/表标识符转义。只用于标识符，不用它拼接数据值或替代数据库权限。

导入使用 `@/utils/sql`，不追加 /index 或扩展名；改契约时同步调用方及本说明。
