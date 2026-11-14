# 导入 SQL

[源码](index.ts)

传入 onImport(sql,title)，返回 beforeImport、importing、error 和 clearError。Upload 在本地读取最多 16 MiB 的 UTF-8 .sql 文件（可带 BOM），校验后创建独立查询标签。拒绝空文件、非 .sql 和无效编码。点击运行时才切分并发送语句。MySQL/MariaDB 的多语句批次在同一会话内执行，最多 10000 条，JSON 请求最多 32 MiB；其他引擎逐条发送，单条请求仍受 1 MiB 限制。载入错误由编辑器区域的 ErrorNotice 展示。
