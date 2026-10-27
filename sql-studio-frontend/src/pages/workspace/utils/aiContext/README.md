# AI 表结构上下文

buildAIContext(scope,tables,structures,sql) 返回 AIContext，只消费当前连接/库的缓存，不请求元数据。SQL 按标识符扫描一次，线性选择当前表、已引用表，再用列表前部补足，最多 12 表/每表 128 字段；备注、字段描述限长，保留反引号名称。

只在续写防抖结束、手动优化发请求时调用，不随输入渲染排序整库。续写 sql 使用编辑器已限制长度的 document/prefix/suffix；优化由用户手动触发。无异步状态或跨页面缓存。
