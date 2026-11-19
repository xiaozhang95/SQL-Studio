# 页面错误来源

`PageErrorsProvider({ children })` 将子区域的操作错误集中到同一页面的 PageHeader。子区域通过 [页面错误上下文](../../contexts/pageErrors/README.md) 登记。隐藏但仍挂载的子区域传入空错误。弹框内直接使用 ErrorNotice。
