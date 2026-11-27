# CHAT

只读页面配置：消息长度、工具显示名称、840px 正文宽度上限。CHAT.content以CSSProperties约束正文和输入区共用的居中布局，两侧各留32px；滚动视口本身不限制宽度。模型菜单与入口图标尺寸分别为modelMenuIconSize（18px）和modelTriggerIconSize（20px）。modelSelectorWidth（192px）为底部模型按钮的宽度上限。

modeConfirmationWidth（720px）为模式切换确认弹窗的桌面宽度，窄屏由Ant Design原生Modal适配。

spacing统一Agent内容节奏：block=middle（原生16px）用于文字/表格/代码/卡片和独立区块，detail=small（原生8px）用于同组元数据、标签/参数和按钮。外层容器负责间距，子组件不重复追加外边距。

roundSwitch 集中虚拟窗口大小（5 轮）、未测高度估算（520px）和末尾判定容差（2px）。只控制本地展示，不影响持久历史和服务端读取。

轮次滚动使用 1 秒的最短加载提示时长。过程详情直接展示，使用 Think 原生折叠动画。

iconButton 统一发送、终止生成和回到底部使用的 Ant Design 标准圆形按钮配置。发送按钮在 Composer 中覆盖为 primary；终止生成使用 danger，回到底部保持 default。悬停和按下使用原生样式。

resultIndexWidth 统一二维结果表格的序号列宽度（56px）。
侧栏尺寸与工作台共用[sidebarLayout](../../../../../constant/sidebarLayout/README.md)，不再维护独立默认值。
composerResize 集中输入区拖拽高度边界（最小 108px、紧凑 96px、最大 560px）、聊天预留高度 180px、键盘步长 24px 与顶部手柄高度 8px。composerRows 默认 2–8 行。conversationMaxWidth 保持 840px，transcriptInset 32px。

工具展示仅提供业务名称及结果标题，不再维护对应 HTTP 端点映射；实际由 Go 业务模块进程内执行。
