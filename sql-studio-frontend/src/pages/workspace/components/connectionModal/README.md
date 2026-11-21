# 连接弹窗

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

[组件索引](../README.md) · [源码](index.tsx)

受控参数：open、connection?、groups、onClose、onSaved。connection 表示编辑，groups 为工作区共享分组选项（含空分组）；成功保存回传脱敏连接。useConnectionForm 管理常规/SSL 页签、校验、测试及保存。

展示已注册引擎，名称、主机和用户名不预填，端口来自 profile。Redis 可选单机、哨兵和集群，按模式显示主节点名称、备用节点和哨兵认证字段。哨兵默认端口 26379，Redis 和哨兵密码可分别留空沿用已保存值。哨兵密码未保存时提示「未启用认证时可留空」，已有密码时提示「已保存，留空不修改」。新建可切换引擎，编辑固定原引擎，分组默认“默认分组”。保存或测试时禁止关闭。SSL 校验服务端证书及主机名。

英文名称、分组、维护库标签分别使用 Name、Group、Database；维护库说明使用简短英文，适配固定标签宽度。

分组选项与输入框中的内置默认分组按当前语言展示，英文为 Default group。Form 的 group 值及 onSelect 使用原始名称，getValueProps 只转换显示，未编辑直接保存仍提交原始默认分组。自定义分组名称原样保留，清空后仍由保存逻辑归入默认分组；筛选支持原名称及显示标签。

表单使用 Ant Design 默认控件，horizontal 布局，label 固定 96px，控件列使用零 flex basis 和 minWidth=0，让长帮助说明在右侧控件下换行，窄窗口不将整列挤到标签下方。类型侧栏宽 `clamp(180px, 26%, 240px)`，内容高度 `min(600px, 100dvh - 240px)`，左右独立滚动；校验和反馈不推动底栏。引擎项高 42px、图标 24px，海豚图标通过数据库 profile 获取。

连接测试结果位于右侧面板底部、按钮栏上方，状态独立于表单滚动。进行中和成功使用 Alert，失败使用全局 ErrorNotice 展示完整原因。长文本换行，最多占右侧面板高度的 35%，超出时纵向滚动。修改表单或切换引擎后清除旧结果，弹窗关闭后清理状态。

弹窗使用共享的暗色 Modal 外框。头部和底栏分隔线通过 Modal 的 styles 设置，颜色取主题 token。遮罩使用 mask.closable；onCancel、onSaved 由调用者管理开关和保存后刷新。forceRender 预先挂载 Form，确保初始化和字段监听始终使用已连接的表单实例；关闭不销毁表单，每次打开由 useConnectionForm 重置字段及校验状态。

数据库类型选项使用原生 text Button，aria-pressed 提供选中语义。选中项由 app.scss 使用共享 controlItemBgActive 中性底，并在左侧显示 2px 主题色竖条；保存或测试期间，禁用的选中项使用主题禁用填充。

底部左侧「测试连接」和「取消」使用 default 按钮，右侧「保存连接」是弹窗唯一 primary 按钮；保留原生悬停、按下、焦点和禁用反馈。默认端口使用中性描边标签，本地加密使用成功状态描边标签。
