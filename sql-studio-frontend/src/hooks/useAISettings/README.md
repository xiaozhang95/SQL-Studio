# 模型列表设置状态

useAISettings() 返回 ready/loading/saving/busy/error、entries、activeId、connectionTests、changed/canSave，以及 show/close/save/upsertEntry/removeEntry/selectActive/testConnection。

show 读取 AIConfigDocument。缺失分区 data=null 使用空列表，其余必须为 configurations 数组、activeId 字符串，每条包含 id/provider/model/modelName/configured。旧单条格式报错。已有记录但 activeId 为空时，列表选中首条作为默认草稿。modelName 与实际 model ID 分开保留。

upsertEntry 合并已完成选择的草稿，按供应商＋模型去重，编辑排除自身。首条记录成为默认。selectActive(id) 切换默认草稿。移除默认记录后选择剩余首条，清空列表时清除 activeId。save 一次 CAS 提交列表及默认记录，省略补全偏好，由后端保留。成功更新基线、清空 Key 并广播，失败保留草稿。

testConnection(id) 按行管理 AbortController/loading/结果，使用未保存的新 Key 或精确 configId 的保存 Key 获取模型，确认所配模型可用；不保存、不启用模型。编辑、移除、关闭或卸载取消请求并丢弃迟到响应，结果仅属于当前行。Key 只存在设置草稿与后端文件，关闭清理。


只请求 /state/ai-models，缺失分区的 null 会成功设置 ready=true、清空错误并开放添加入口；不再访问旧 /state/ai 文件数据。新分区的真实读取故障仍按错误处理，不自动覆盖。
