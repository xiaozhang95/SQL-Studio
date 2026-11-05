# 连接弹窗

[组件索引](../README.md) · [源码](index.tsx)

受控参数：open、connection?、groups、onClose、onSaved。connection 表示编辑，groups 为工作区共享分组选项（含空分组）；成功保存回传脱敏连接。useConnectionForm 管理常规/SSL 页签、校验、测试及保存。

展示注册的 MySQL、MariaDB 和 PostgreSQL，名称/主机/用户名不预填，端口来自 profile；PostgreSQL 显示维护库（默认 postgres）。新建可切换引擎，编辑固定原引擎，分组默认“默认分组”。编辑不回显密码，留空保留旧值；保存或测试时禁止关闭。SSL 使用服务端证书校验，不提供跳过选项。

表单使用 Ant Design 默认控件，horizontal 布局，label 固定 96px，控件列使用零 flex basis 和 minWidth=0，让长帮助说明在右侧控件下换行，窄窗口不将整列挤到标签下方。类型侧栏 280px，内容高度 min(600px, 100dvh - 180px)，左右独立滚动；校验和反馈不推动底栏。海豚图标通过数据库 profile 获取。

测试中、成功和失败统一使用右侧面板底部、按钮栏上方的整宽 Alert 横条，状态独立于表单滚动。成功直接展示版本号，失败展示完整错误；长文本换行，最多占右侧面板高度的 35%，超出时纵向滚动。修改表单或切换引擎后清除旧结果，弹窗关闭后清理状态。

弹窗边框、头部及底栏内边距沿用 Ant Design 默认值。左右面板之间使用布局分隔线。遮罩使用 mask.closable；onCancel、onSaved 由调用者管理开关和保存后刷新。

数据库类型选项使用原生 Button primary/text，边框、阴影、选中和 hover 外观沿用组件默认值；仅设置图标所需的行高及图文排列，aria-pressed 提供选中语义。引擎名称沿用默认文字，不额外加粗。
