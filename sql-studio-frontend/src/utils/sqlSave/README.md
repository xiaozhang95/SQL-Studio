# 关闭前保存 SQL

`saveSQL(sql: string, title: string): Promise<void>` 桌面端通过 [exportWriter](../exportWriter/README.md) 选择路径、分块写入并提交。选路径取消抛 AbortError；浏览器优先原生文件选择器保存 .sql，等待写入关闭成功后完成。取消/写入失败抛错，调用方必须保留查询页。不支持原生选择器时沿用 sqlExport 的下载导出；此时表示已发起下载，不保证用户已完成落盘。
