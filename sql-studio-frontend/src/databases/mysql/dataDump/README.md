# 结构和数据转储

dumpData(database,table,result,columns) 返回显式列名 INSERT，跳过生成列。保留精确数值、NULL、UTF-8 文本及二进制值，不受反斜杠 SQL mode 影响；拒绝空间/向量与截断结果。工作区转储通过专用 SSE 接口按批传入结果。输出不执行写入。
