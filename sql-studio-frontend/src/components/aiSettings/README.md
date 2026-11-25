# 模型配置列表

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

AISettings({model,disabled}) 展示模型记录卡片。每行左侧为 30px 品牌图标容器，模型名称加粗，实际模型 ID 以次级文字放在下方；文字字号和字体统一跟随全局设置。模型名过长时省略，悬停可查看全名。modelName 保存模型发现接口返回的名称，model 保存实际调用 ID。模型卡片使用同一中性边框。默认模型卡使用浅色底，原生 Radio 显示「默认」。其余卡片沿用弹窗底色，显示「设为默认」。底部保存后生效。列表上方只提供「已添加模型」标题，下方提供左对齐的虚线「添加模型」按钮。

每行操作为编辑和删除。删除复用全局 DeleteConfirmation 气泡确认，确认后从草稿移除，保存设置后生效。

[modelEditor](components/modelEditor/README.md) 使用横向供应商、Key、模型表单；[useModelEditor](hooks/useModelEditor/README.md) 管理请求和草稿。选供应商、输入 Key 自动加载模型后默认选中第一项，用户可另选，也可在模型一侧手动刷新；已有选择和编辑记录保留原模型。供应商可重复添加不同模型，相同供应商＋模型 ID 禁止重复，编辑排除自身，无覆盖流程。

子弹框添加/应用仅更新设置草稿，底部总保存才持久化；取消整个设置放弃未提交修改。最多64条，仅支持已实现的 DeepSeek。全局数据只读写新 configurations/activeId/completionEnabled 格式，不兼容旧单条配置。Key 不展示在列表、不进入浏览器存储。
