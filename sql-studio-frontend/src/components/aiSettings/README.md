# 模型配置列表

AISettings({themeMode,model,disabled}) 管理模型记录，显示“图标＋供应商＋模型名称”；modelName 保存模型发现接口返回的名称，model 保存实际调用 ID。列表没有 Radio、启用选项或点击行选择模型逻辑，当前模型在 SQL 工具栏或 Agent 输入区的使用入口选择。

每行操作为编辑、测试连接、移除。测试按钮独立 loading，使用该行的 Key 或 configId 对应的后端 Key，验证目标模型在此 Key 的模型列表中；按钮成功/失败图标和 Tooltip 显示结果，失败不改变配置、不切换模型、不写入设置。编辑/移除或关闭取消对应测试，迟到响应不更新新记录。

[modelEditor](components/modelEditor/README.md) 使用横向供应商、Key、模型表单；[useModelEditor](hooks/useModelEditor/README.md) 管理请求和草稿。选供应商、输入 Key 自动加载模型后手动选择，也可在模型一侧手动刷新；发现不自动选默认/首个模型。供应商可重复添加不同模型，相同供应商＋模型 ID 禁止重复，编辑排除自身，无覆盖流程。

子弹框添加/应用仅更新设置草稿，底部总保存才持久化；取消整个设置放弃未提交修改。最多64条，仅支持已实现的 DeepSeek。全局数据只读写新 configurations/activeId/completionEnabled 格式，不兼容旧单条配置。Key 不展示在列表、不进入浏览器存储。
