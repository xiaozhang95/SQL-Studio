# 表设计页面

[源码](index.tsx) · [组件索引](../README.md)

TableDesigner 接收 page:WorkspaceTab、connections、blocked、available、themeMode，以及按页面 ID 回报忙碌/未保存状态、提交成功和对象变更的回调。每页通过 useTableDesigner 拥有独立状态；正文复用 objectManagementForm，不使用 Modal。

顶栏固定保存、预览 SQL、重新加载及实际连接/库/表范围，正文占满右侧剩余高度并独立滚动。工作区 Tab 上显示未保存星号；切到其他页保留表单和 SQL 预览。同一对象的设计入口复用原页，新建表允许多份独立草稿。连接关闭时保留草稿，提示重新打开连接，禁止保存；其他写入或普通查询进行时也禁止提交。

保存成功继续停留原标签，新建页变成该表设计页，重新读取结构作为下次差异基准；不会重复发送 CREATE。重新加载有未保存内容时需确认放弃。关闭及批量关闭的草稿确认由工作区管理，页面未加载前不预取元数据。
