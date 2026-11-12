# 模型添加与编辑草稿

useModelEditor(entries,onCommit) 管理独立添加/编辑草稿；show(entry?)、close、changeProvider、changeKey、changeModel、refreshModels、commit 供组件调用。选择供应商后输入 Key，停顿500ms自动加载模型，也可用模型下拉框右侧按钮手动刷新。手动刷新取消防抖与旧请求；编辑时自动读取模型列表并保留原选择。换供应商或 Key 清空模型，用户须手动选择，不回落默认或首个模型。

按供应商与模型 ID 排除重复（编辑排除自身），只允许有效模型与 Key 提交。commit 仅调用 onCommit 将完整记录加入系统设置草稿，外层总保存才持久化；取消不改变列表。请求有独立 AbortController 与代次，换字段、关闭或卸载取消，迟到响应不得改写新草稿；Key 不写浏览器存储或日志。
