# 跨层业务契约

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

Connection、QueryRequest/QueryResult、TableRef/Table/Column，以及MySQL 类型校验。

## 约束与调用

保持 JSON 字段兼容，表身份包含数据库与表名；精确数值使用文本，不能在 HTTP 层转为 float64。

Connection.group 为可选连接分组字符串，NormalizeConnectionGroup 去除首尾空白并将省略/空值归入 DefaultConnectionGroup（“默认分组”）；落盘连接必须包含规范化的分组名称。分组不参与数据库连接参数。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。

StateDocument/StateWrite 定义用户配置 schemaVersion/revision/updatedAt/data/extensions 信封与 CAS 提交。

AIRequest/AIResult/AITable/AIMessage 定义模型输入输出，不携带数据库密码或查询结果。

AIConfig 只定义 configurations/activeId/completionEnabled 新格式，无旧单条字段或镜像。AIConfiguration 增加 modelName 显示名称，model 为调用 ID，响应逐行清除 Key。SelectedConfiguration 只解析使用处明确选择的记录，不回落默认。AIModelsRequest.configId 精确定位要复用 Key 的记录。

AIRequest.document/table携带注释草稿与选中表，AIConnectionContext仅包含Name/Type安全字段，由AI模块按ConnectionID填充。

Index/IndexColumn 为索引只读契约，保存名称、唯一性、类型以及按 position 排列的组成字段（name、可空 prefixLength、order）；PRIMARY 表示主键，表达式字段名为空。

TypePostgreSQL=postgresql，SupportedDatabaseType 接受 MySQL/PostgreSQL；Connection.Database 是可选维护库，PostgreSQL 缺省 postgres。PostgreSQL Table.Name 为双引号 schema/table 对，TableRef 原样传递；schema 不混入物理数据库。

Index.Primary 是可选 JSON primary 主键标志；PostgreSQL 保留实际索引名称并显式设置，MySQL 兼容 PRIMARY 名称。

QueryRequest.Schema 和 AIRequest.Schema 是可选 schema 字段，区别于物理数据库。旧客户端省略时兼容原范围。

workspace.go 定义v2 WorkspacePage/WorkspaceIndex/WorkspaceDocument/WorkspaceCommit：标签元数据与草稿/结果散列引用、布局、修订号及仅变化部分的提交。结果为不执行的JSON对象，草稿为文本；不包含连接密码。

TypeMariaDB=mariadb，为独立的受支持连接身份；IsMySQLProtocol 仅描述 MySQL/MariaDB 线协议复用，不把 MariaDB 归一化成 MySQL。

- [agent](agent/README.md)：Agent工具、模型流与会话契约；独立子包避免与SQL结果/配置同名类型冲突。

QueryRequest.MatchRows（JSON matchRows）默认为false；只供显式单元格UPDATE请求MySQL/MariaDB匹配行计数，不改变普通SQL语义或权限限制。
