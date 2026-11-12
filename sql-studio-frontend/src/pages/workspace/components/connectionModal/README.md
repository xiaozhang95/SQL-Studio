# 连接弹窗

[组件索引](../README.md) · [源码](index.tsx)

受控参数：open、connection?、groups、onClose、onSaved。connection 表示编辑，groups 为工作区共享分组选项（含空分组）；成功保存回传脱敏连接。useConnectionForm 管理常规/SSL 页签、校验、测试及保存。

展示注册的 MySQL、MariaDB 和 PostgreSQL，名称/主机/用户名不预填，端口来自 profile；PostgreSQL 显示维护库（默认 postgres）。新建可切换引擎，编辑固定原引擎，分组默认“默认分组”。编辑不回显密码，留空保留旧值；保存或测试时禁止关闭。SSL 使用服务端证书校验，不提供跳过选项。

表单使用 Ant Design 默认控件，horizontal 布局，label 固定 96px，控件列使用零 flex basis 和 minWidth=0，让长帮助说明在右侧控件下换行，窄窗口不将整列挤到标签下方。类型侧栏 280px，内容高度 min(600px, 100dvh - 180px)，左右独立滚动；校验和反馈不推动底栏。海豚图标通过数据库 profile 获取。

测试中、成功和失败统一使用右侧面板底部、按钮栏上方的整宽 Alert 横条，状态独立于表单滚动。成功直接展示版本号，失败展示完整错误；长文本换行，最多占右侧面板高度的 35%，超出时纵向滚动。修改表单或切换引擎后清除旧结果，弹窗关闭后清理状态。

弹窗使用共享的暗色 Modal 外框。头部和底栏分隔线通过 Modal 的 styles 设置，颜色取主题 token。遮罩使用 mask.closable；onCancel、onSaved 由调用者管理开关和保存后刷新。

数据库类型选项使用原生 text Button，aria-pressed 提供选中语义。选中项由 app.scss 使用共享 controlItemBgActive 灰色底，略深于普通悬停。保存或测试期间，禁用的选中项使用主题禁用填充。文字和引擎图标沿用原有样式。

常规操作按钮使用 Ant Design default 类型，保留原生悬停、按下、焦点和禁用反馈，不增加交互颜色覆盖。

默认端口使用 Ant Design 中性标签，本地加密使用成功状态标签。
