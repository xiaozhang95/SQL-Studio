# 用户状态配置格式

默认目录为用户主目录下的 `.sql-studio/state/`，Go 服务和 Electron 共用这一默认值。`SQLDESK_STATE_DIR` 可指定状态目录，`SQLDESK_DATA_DIR` 可单独指定连接目录，默认与状态目录相同。存储仅读写当前目录和最新格式。每个目录由一个后端进程使用。

| 文件 | 当前内容 |
| --- | --- |
| workspace-index.json | v2 页面、内容引用、查询范围与布局轻量索引 |
| workspace-parts/<SHA256>.json | 按页保存的 SQL 草稿与结果 |
| history.json | 各连接最近50条执行历史 |
| appearance.json | 完整 theme/fontSize 外观偏好 |
| ai-models.json | 模型配置列表、使用处选择的记录和补全偏好 |
| connections.json | connections/groups 对象，连接必须明确保存 type/group，密码为 AES-GCM 密文 |
| master.key | 连接加密密钥，不能缺失后覆盖已有连接 |
| agent/layout.json | 当前 mode/activeId/draft/expanded 布局 |
| agent/conversations/ | 当前 v2 manifest、轻量索引与消息/事件内容块 |

普通状态分区使用 {schemaVersion:1,revision,updatedAt,data,extensions?} 信封，业务内容只接受各自当前格式。GET/PUT /api/state/:section 以 revision 做 CAS，冲突409，不重试覆盖；连接、工作区与 Agent 使用各自专用接口。

首次文件缺失初始化当前默认值：空 v2 工作区、空历史、system/standard 外观、空模型列表、只读 Agent 布局。工作区首次创建当前索引，不读取其他文件。现存格式错误、文件损坏或权限故障明确报错，不能静默重置或改写。新建连接的空分组输入使用当前默认分组；读取文件不补缺失字段。

每个分区最多32MiB内容，状态文件最多33MiB；0600临时文件 Sync 后同目录原子替换，目录0700。Windows权限取决于当前目录 ACL。connections.json 与 master.key 须一起备份；公开连接接口不返回密码，模型配置接口逐行清除 Key，`ai-models.json` 含本机保存的明文 Key。普通状态接口禁止访问连接文件与废弃密钥分区。

工作区与历史按当前防抖策略保存，顶部只在保存期间展示 loading，错误由页面区域提示。强制关闭可能丢失尚未提交修改。恢复不执行 SQL、不写业务数据库；查询草稿、结果和对话文本可能包含敏感内容。

工作区内容按散列保存，提交先发布分片再提交索引，读取校验散列；未引用内容按当前回收策略清理，不删除仍被索引引用的内容。Agent 只读写当前 v2 分片会话，不转换其他会话格式。
