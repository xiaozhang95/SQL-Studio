# 查询结果边界

readResult(unknown) 校验列、二维行及列数一致性，返回有界表格数据或 null。保留重复列名、NULL 和精确数值字符串，不转浮点。cellText(value, emptyText?) 格式化 NULL 与 JSON 值，只有空字符串使用调用方传入的本地化占位，默认显示「空字符串」。readSQL 从工具参数中只读提取 SQL，解析失败返回空字符串。
