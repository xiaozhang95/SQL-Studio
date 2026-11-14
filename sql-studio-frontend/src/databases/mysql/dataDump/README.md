# 结构和数据转储

dumpData(database,table,result,columns) 返回显式列名的多值 INSERT，跳过生成列。每段 SQL 最多 256 Ki 个 UTF-16 码元，大小超过该值的单行独占一条 INSERT。保留精确数值、NULL、UTF-8 文本及二进制值，不受反斜杠 SQL mode 影响；拒绝空间/向量与截断结果。工作区转储通过专用 SSE 接口按批传入结果。输出不执行写入。

viewStandIn(database,view,ddl,columns) 生成保留全部列名、文本字符集与排序规则的占位视图，以及保留原定义的 ALTER VIEW。多视图转储先建立所有占位视图，再替换定义，允许正向引用且已有同名对象仍会报错。单视图不需要占位。该方法也供 MariaDB 使用。
