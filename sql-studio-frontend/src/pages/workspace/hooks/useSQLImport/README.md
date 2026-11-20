# 导入 SQL

[源码](index.ts)

传入 onImport(sql,title)，返回 beforeImport、importing、error 和 clearError。Upload 在本地读取最多 16 MiB 的 UTF-8 .sql 文件（可带 BOM），校验后创建独立查询标签。拒绝空文件、非 .sql 和无效编码。点击运行时切分并发送语句。MySQL、MariaDB 和 PostgreSQL 的同会话批次最多 10000 条语句，单语句和批次 JSON 请求最多 32 MiB。载入错误显示在工作区顶栏下方。
