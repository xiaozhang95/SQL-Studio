# SQL AI 模块

New(Repository, Connections, Generator) 注入本机 AI 配置、按 ID 获取连接和模型客户端。Assist(ctx, model.AIRequest) 返回 model.AIResult；只依赖 model，不执行 SQL，不读取数据库数据。

complete 接收 prefix/suffix，optimize 接收 sql。上下文显式携带 connectionId/database 和当前库缓存 tables（最多12表，每表128字段）。SQL 输入合计最多48000字节。续写12秒/256 tokens，优化30秒/3000 tokens；全进程4并发预算，满额 ErrBusy；继承调用者取消。配置缺失、输入及模型响应无效时返回错误，不缓存跨连接状态。Key 从 Repository.Read(model.AIModelsSection) 在后端读取，不进入响应或日志。

Models(ctx, AIModelsRequest) 使用本次新 Key 或按可选 configId 精确复用对应记录的 Key，10秒超时，共用4并发预算；未知 ID 不回落其他记录，不回传 Key。模型发现不选择模型。Assist 只调用明确选择的模型 ID，空模型直接拒绝，不回落默认模型；completionEnabled=false 时拒绝续写。

续写提示词明确SQL关键词不区分大小写，保留用户的关键词风格及标识符、字符串、注释原文。对未完成SELECT提供短片段建议，不因小写关键词或尚未选表直接返回空；模型确实无法推断时仍可返回空。

AIRequest增加document（最多64KB）、table和表/字段备注。连接名称与引擎由服务端按显式ID解析，只发送name/type，不含主机、用户名或密码；客户端伪造connection会被覆盖。SQL注释作为查询意图使用，不能覆盖系统角色和响应格式。

AI 允许已实现的 mysql/mariadb/postgresql 引擎，系统提示按实际 connection.Type 使用对应方言，不发送数据库凭据。MariaDB 独立于 MySQL，提示词明确保留 INSERT/REPLACE/DELETE RETURNING，避免套用 MySQL 的语法限制；生成建议仍须由用户审阅，不自动执行。
