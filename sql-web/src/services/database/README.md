# 数据库 API 服务

[源码](index.ts)

统一封装连接列表/保存/删除/测试、库表/字段/DDL 与 SQL 请求。请求走 /api，元数据和查询接受 AbortSignal。具体路径与结果见根目录 docs/API.md。

导入使用 `@/services/database`，不追加 /index 或扩展名；改契约时同步调用方及本说明。
