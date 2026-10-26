# 结构和数据转储

dumpData(database,table,result,columns) 返回显式列名 INSERT，跳过生成列。保留精确数值、NULL、UTF-8 文本及二进制值，不受反斜杠 SQL mode 影响；拒绝空间/向量与截断结果。调用方只读获取最多 5000 行、8 MiB，超限明确失败，不下载残缺文件。输出不执行写入。
