# 页面错误上下文

`usePageError(error?, occurrence?)` 登记一个错误原因或一组稳定的错误原因。发生标识接受字符串或数字，区分原因相同的操作。组件卸载、离开当前范围或清空原因时撤销登记。`usePageErrors()` 供 PageHeader 读取和关闭当前提示。关闭提示保留执行记录和当前操作状态。
