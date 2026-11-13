# 导入 SQL

[源码](index.ts)

传入 onImport(sql,title)，返回 beforeImport、importing、error 和 clearError。Upload 在本地读取 .sql，校验后创建独立查询标签。支持 UTF-8/BOM，拒绝空文件、非 .sql、错误编码及超过 1 MiB 或 JSON 编码后请求上限的内容。失败原因由编辑器区域的 ErrorNotice 展示。
