# 模型添加与编辑草稿

useModelEditor(entries,onCommit) 管理独立添加/编辑草稿；show(entry?)、close、changeProvider、changeKey、changeModel、refreshModels、commit 供组件调用。选择供应商后输入 Key，停顿500ms自动加载模型，也可用模型下拉框右侧按钮手动刷新。列表读取成功且尚未选择模型时，默认选中返回的第一项并同步 model/modelName；用户仍可切换。手动刷新取消防抖与旧请求；已有选择及编辑记录保留原模型，原模型不在列表时不能提交，不静默替换。换供应商或 Key 先清空模型，重新读取成功后默认选中首项。

按供应商与模型 ID 排除重复（编辑排除自身），只允许有效模型与 Key 提交。commit 仅调用 onCommit 将完整记录加入系统设置草稿，外层总保存才持久化；取消不改变列表。请求有独立 AbortController 与代次，换字段、关闭或卸载取消，迟到响应不得改写新草稿；Key 不写浏览器存储或日志。
