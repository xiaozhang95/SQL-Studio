# 导入 SQL

[源码](index.ts)

传入 onImport(sql,title)，返回 beforeImport 与 importing。Upload 在本地读取 .sql，校验后创建独立查询标签，不自动运行，不上传文件。支持 UTF-8/BOM；拒绝空文件、非 .sql、错误编码及超过 1 MiB 或 JSON 编码后请求上限的内容。读取失败由 message 反馈，原查询不覆盖。
