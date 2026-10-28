# 连接弹窗

[组件索引](../README.md) · [源码](index.tsx)

受控参数：open、connection?、connections、onClose、onSaved。connection 表示编辑，connections 提供分组选项；成功保存回传脱敏连接。useConnectionForm 管理常规/SSL 页签、校验、测试及保存。

展示注册的 MySQL 和 PostgreSQL，名称/主机/用户名不预填，端口来自 profile；PostgreSQL 显示维护库（默认 postgres）。新建可切换引擎，编辑固定原引擎，分组默认“默认分组”。编辑不回显密码，留空保留旧值；保存或测试时禁止关闭。SSL 使用服务端证书校验，不提供跳过选项。

表单使用 Ant Design 默认控件，horizontal 布局，label 固定 96px。类型侧栏 280px，内容高度 min(600px, 100dvh - 180px)，左右独立滚动；校验和反馈不推动底栏。海豚图标通过数据库 profile 获取。

弹窗边框和连接弹窗头部/底栏分隔线全部在 app.scss，主题色来自 Ant Design token，不在组件中另写覆盖。遮罩使用 mask.closable；onCancel、onSaved 由调用者管理开关和保存后刷新。

数据库类型选项使用原生 Button primary/text，无边框和阴影；选中保持 primary 背景，未选中透明、hover 使用原生背景，aria-pressed 提供选中语义。
