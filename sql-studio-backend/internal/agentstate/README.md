# 本地文件仓库

New(directory)创建单进程共享Store，不启动时强制写入。List/Load/Save/Delete维护会话，ReadWorkspace/WriteWorkspace维护布局。每会话版本内容先写入conversations/id-revision.json，最后原子提交轻量index.json作为权威引用；失败不发布新版本。成功后清理该会话上一版本。布局layout.json独立schemaVersion/revision/updatedAt/state，CAS冲突返回model.ErrConflict。

文件上限32MiB，0600临时文件Sync/Close后同目录Rename，目录0700。JSON损坏或版本不支持返回错误，不回落空值覆盖。ID仅接受48位小写十六进制，拒绝路径穿越。context提交前检查；原子提交后取消不代表回滚。模型 API Key 由共享 `ai-models` 分区管理。会话文件位于状态目录的 `agent/conversations/`，包含用户问题、模型内容、SQL 和有界结果。只支持一个进程拥有目录。

Agent Layout 必须完整保存 mode/activeId/draft/expanded，mode 只接受 readonly/write；新文件初始化 readonly，已保存文件缺字段直接拒绝。

包名 agentstate。会话版本schema v2的data只保存元信息、摘要和发现范围，MessageParts/EventParts引用本会话id-parts/<SHA256>.json；每32条消息/事件一个稳定内容块。先写新内容、再版本manifest、最后原子替换index；仅支持当前 v2 manifest，不读取或转换 v1 会话。单块上限32MiB而非整条会话总上限；读取校验散列。成功后清理旧manifest及被替换的块，明确删除会话才清理其内容目录，保留其他会话。失败提交可能留下未引用块，不发布到索引。

最多缓存4条最近保存会话的不可变块基线；稳定块先比较已知内容并复用引用，避免每秒重新序列化全部历史。缓存不改变索引权威性和内容读取时的散列校验。
