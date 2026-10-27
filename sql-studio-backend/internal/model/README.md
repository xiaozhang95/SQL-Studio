# 跨层业务契约

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

Connection、QueryRequest/QueryResult、TableRef/Table/Column，以及MySQL 类型校验。

## 约束与调用

保持 JSON 字段兼容，表身份包含数据库与表名；精确数值使用文本，不能在 HTTP 层转为 float64。

Connection.group 为可选连接分组字符串，NormalizeConnectionGroup 去除首尾空白并将省略/空值归入 DefaultConnectionGroup（“默认分组”）；旧配置无需迁移，分组不参与数据库连接参数。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。

StateDocument/StateWrite 定义用户配置 schemaVersion/revision/updatedAt/data/extensions 信封与 CAS 提交。

AIRequest/AIResult/AITable/AIMessage 定义模型输入输出，不携带数据库密码或查询结果。

AIConfig统一AI配置内部结构和脱敏响应，model/CompletionEnabled兼容缺省值；AIModel和AIModelsRequest定义官方模型发现契约。

AIRequest.document/table携带注释草稿与选中表，AIConnectionContext仅包含Name/Type安全字段，由AI模块按ConnectionID填充。

Index/IndexColumn 为索引只读契约，保存名称、唯一性、类型以及按 position 排列的组成字段（name、可空 prefixLength、order）；PRIMARY 表示主键，表达式字段名为空。
