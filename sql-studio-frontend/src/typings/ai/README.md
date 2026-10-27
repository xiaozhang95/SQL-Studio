# AI 契约

导出 AIContext（connectionId/database/tables）、AITable（name/columns）、AIRequest（complete 或 optimize 及 SQL 前后文）、AIResult（completion 或 sql/explanation）。契约对应后端 model/ai.go；不包含 Key、查询结果或连接凭据。

AIContext包含当前table，AITable支持comment，AIRequest.document携带保留注释的草稿开头上下文；模型所需连接名称/引擎由后端解析补充。

AIContext/AIRequest.schema? 传递当前 PostgreSQL schema，用于未限定表名解析，不包含数据库密码或数据行。
