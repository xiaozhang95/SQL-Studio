# Agent布局

New(Repository)注入最小读写接口；Read返回Workspace，Save校验activeId、草稿和展开键后CAS提交。仅保存当前会话、草稿及过程展开/隐藏状态；主题统一由SQL Studio管理，不保留旧Agent主题兼容字段。恢复不执行SQL或调用模型。
