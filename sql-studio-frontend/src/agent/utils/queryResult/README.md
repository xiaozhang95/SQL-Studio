# 查询结果边界

readResult(unknown)校验列、二维行及列数一致性，返回有界表格数据或null；保留重复列名、NULL和精确数值字符串，不转浮点。cellText处理空字符串、NULL与JSON值。readSQL从工具参数中只读提取SQL，解析失败返回空字符串，不执行内容。
