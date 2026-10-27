# 库表确认弹窗

[源码](index.tsx) · [组件索引](../README.md)

ObjectManagementModal 接收 manager（useObjectManagement 返回值）及 themeMode，只负责 Modal、确认按钮、加载状态和取消；正文由 objectManagementForm 复用。宽 640px，沿用 Ant Design 默认外观，正文限高滚动。

仅承载新建/编辑/删除数据库、删除表、清空表及重命名；CreateTable/EditTable 不显示 Modal，由右侧 tableDesigner 标签页承载。加载时禁用提交，保存期间禁止关闭。危险动作输入完整对象名称确认，提交使用 danger 按钮；预览、错误及元数据归 manager 控制。取消中止只读加载，取消不表示数据库写入回滚。
