# 查询结果 CSV

[源码](index.ts)

exportCSV(columns, rows)：导出二维行数组、保留重复列头；双引号转义，BOM 支持表格软件，防止单元格被解释为公式。仅导出调用者传入的筛选结果。

导入使用 `@/utils/csv`，不追加 /index 或扩展名；改契约时同步调用方及本说明。
