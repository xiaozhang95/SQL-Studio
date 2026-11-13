# 模型配置列表

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

AISettings({model,disabled}) 展示模型记录。每行左侧为供应商品牌图标，模型名称加粗放在上方，供应商以次级文字放在下方。模型名过长时省略，悬停可查看全名。modelName 保存模型发现接口返回的名称，model 保存实际调用 ID。每行的「默认」单选项用于查看和切换共享默认模型，底部保存后生效。

每行操作为编辑、测试连接、删除。删除需确认，确认后从草稿移除，保存设置后生效。测试按钮独立 loading，使用该行的 Key 或 configId 对应的后端 Key，验证目标模型在此 Key 的模型列表中。按钮成功/失败图标和 Tooltip 显示结果。编辑、删除或关闭会取消对应测试，迟到响应不更新新记录。

[modelEditor](components/modelEditor/README.md) 使用横向供应商、Key、模型表单；[useModelEditor](hooks/useModelEditor/README.md) 管理请求和草稿。选供应商、输入 Key 自动加载模型后手动选择，也可在模型一侧手动刷新；发现不自动选默认/首个模型。供应商可重复添加不同模型，相同供应商＋模型 ID 禁止重复，编辑排除自身，无覆盖流程。

子弹框添加/应用仅更新设置草稿，底部总保存才持久化；取消整个设置放弃未提交修改。最多64条，仅支持已实现的 DeepSeek。全局数据只读写新 configurations/activeId/completionEnabled 格式，不兼容旧单条配置。Key 不展示在列表、不进入浏览器存储。
