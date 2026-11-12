# 用户配置模块

New(Repository) 注入 Read/Write。分区名校验及32MiB JSON限制由 service.go 处理；connections 为保留分区，ErrConflict 表示修订冲突。继承调用者 context，无额外业务缓存，并发由仓库 CAS 管理。

AI 配置使用 AIConfig 列表格式。configurations 为可为空的数组，activeId 为默认记录 ID，completionEnabled 为补全偏好。每条 AIConfiguration 含 id/provider/model/modelName/apiKey。model 是实际调用 ID，modelName 是模型接口返回的显示名称。旧顶层字段、旧单条配置或缺少列表均拒绝。

ai.go 校验最多64条、记录 ID 唯一、供应商与模型组合不重复、模型和显示名称有效。完整列表一次 CAS 替换；编辑空 Key 仅按相同 ID 与供应商保留该行 Key，新增必须填写。省略补全偏好保留原值。响应逐行清除 Key，返回 configured；密钥不进入日志、工作区或浏览器持久化。

activeId 可由系统设置模型列表或 AI 助手模型菜单切换。保存非空列表且 activeId 为空时写入首条可用记录的 ID。旧列表读取和调用按同一规则解析默认模型，读取不写盘。AgentStatus 的 models 为已添加配置 ID 与显示名称，UpdateAgent 通过 {configId} 切换默认记录。

RemoveAI(ctx,revision) 清空所有记录并关闭补全，保留修订防止旧窗口复活配置。读取磁盘损坏或不支持格式原样报错，不自动覆盖用户文件。


新版模型只使用 model.AIModelsSection=ai-models，对应 ai-models.json；不读取、转换或覆盖旧 ai.json。缺失新分区返回 revision=0,data=null，前端以空列表初始化并允许添加。旧 ai 分区禁止经通用状态 API 访问，避免原密钥明文外泄。
