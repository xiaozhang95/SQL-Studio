# 主区域页面标签

[源码](index.tsx) · [组件索引](../README.md)

model 提供 tabs/activeTab、runs/resultViews、运行状态和切换/关闭回调，children 为当前页。只有这一层 Tabs；查询 SQL 和本批所有结果共用一个主页面。

按 kind 显示图标，运行页显示 loading。颜色根据每页 resultViews.resultIndex 对应语句的成功/失败状态决定，与结果 Select 同步；非活动页也保留自己的结果选择和颜色。切换销毁隐藏展示组件，业务状态保留在工作区并加密恢复。

右键关闭当前/其他/右侧按目标计算，执行中禁止关闭；最后一页可关闭并保存为空，下次刷新仍为空。
