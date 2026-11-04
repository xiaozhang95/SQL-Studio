# SQL 查询模块

`New(repository Connections, executor Executor) *Service` 注入凭据读取及单语句执行接口。app 在启动时创建一次，同进程所有查询共用该模块的 4 个并发槽位，不在每次请求时重建。

`WithExecutor(executor Executor) *Service` 在启动装配时创建独立执行范围，替换该范围的引擎实例，保留同一凭据读取接口、4个并发槽位及原有超时/限制；不修改原Service。Agent使用此方法隔离工作台连接开关、取消与请求生命周期，不能通过独立范围扩增并发预算。

`Query(ctx context.Context, id string, input model.QueryRequest) (model.QueryResult, error)` 校验非空 SQL，按显式 ID 读取连接；行数默认 1000，最大 5000，超时 30 秒，继承请求取消。超出并发返回 `ErrBusy`，HTTP 将其映射为 429；结束或失败均释放槽位。

默认只读及单语句执行由 MySQL 实现继续保证，模块不放宽驱动约束。`AllowWrite` 保持现有 API 契约，前端不提供开关；取消不表示写入已回滚。结果保留 model 契约和精确数值文本。

模块不依赖 HTTP、文件系统、驱动或兄弟模块。测试使用临时仓库和执行替身覆盖凭据、限制、超时与并发释放；真实数据库验证须另行显式启用集成测试。
