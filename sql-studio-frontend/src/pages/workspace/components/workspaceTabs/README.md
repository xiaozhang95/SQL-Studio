# 主区域页面标签

[源码](index.tsx) · [组件索引](../README.md)

model 提供 tabs/activeTab、runs/resultViews、运行状态和切换/关闭回调，children 为当前页。只有这一层 Tabs；查询 SQL 和本批所有结果共用一个主页面。

按 kind 显示图标，运行页显示 loading。颜色根据每页 resultViews.resultIndex 对应语句的成功/失败状态决定，与结果标签 同步；非活动页也保留自己的结果选择和颜色。切换销毁隐藏展示组件，业务状态保留在工作区并加密恢复。

右键关闭当前/其他/右侧按目标计算，执行中禁止关闭；最后一页可关闭并保存为空，下次刷新仍为空。

主页面的导航和内容高度覆盖仅作用于直属导航栏及内容容器，不影响结果区的嵌套 Tabs。

主页面与结果导航统一采用单侧分隔线：页签不绘制左边框，仅保留右侧 1px 主题边框；相邻项不叠加，首项不重复侧栏边界。样式限定在 app.scss 对应 Ant Design 导航覆盖内。

Ant Design 6 主页面的 body-holder → body → content → workspace-page 连续传递高度，content 层的 100% 仅作用于直属主页面容器，避免编辑器和结果区塌缩。

model 额外提供 connections/designerDirty，renderDesigner(page) 注入表设计页面。table-create/table-design 使用设计图标，Tab 星号标记未保存；隐藏时保留已访问的组件实例，不提前加载未访问页。其他页面继续切换销毁展示组件。主页面标签的关闭和右键批量关闭复用工作区回调并检查草稿。

全局不启用 destroyOnHidden，仅逐项设置；否则全局销毁会覆盖设计页的 false，导致切页丢失草稿。查询等普通页仍按项销毁，设计页保持挂载。
