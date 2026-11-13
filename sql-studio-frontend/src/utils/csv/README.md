# 查询结果 CSV

[源码](index.ts)

exportCSV(columns, rows) 下载传入的筛选结果，保留重复列头，添加 UTF-8 BOM，转义双引号及公式开头。下载链接接入文档，Blob URL 延迟释放，让浏览器有时间读取文件。

导入使用 `@/utils/csv`，不追加 /index 或扩展名；改契约时同步调用方及本说明。
