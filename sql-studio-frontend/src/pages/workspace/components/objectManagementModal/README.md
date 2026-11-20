# 库表确认弹窗

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

[源码](index.tsx) · [组件索引](../README.md)

ObjectManagementModal 接收 manager（useObjectManagement 返回值）及 themeMode，只负责 Modal、确认按钮、加载状态和取消；正文由 objectManagementForm 复用。宽 640px，沿用 Ant Design 默认外观，正文限高滚动。通过 forceRender 预先挂载表单，保证首次打开前的 resetFields/setFieldsValue 已连接到 Form；每次打开仍由 manager 重置字段并加载当前目标。

承载新建、编辑或删除数据库，以及删除、清空或重命名表。CreateTable/EditTable 由右侧 tableDesigner 标签页承载。加载时禁用提交，保存期间禁止关闭。危险动作输入完整对象名称确认，提交使用 danger 按钮。删库或删表前可保存关联 SQL 草稿，或确认放弃未保存的改动。对象删除成功后关闭关联标签页。预览、错误及元数据由 manager 控制。

常规操作按钮使用 Ant Design default 类型，保留原生悬停、按下、焦点和禁用反馈，不增加交互颜色覆盖。
