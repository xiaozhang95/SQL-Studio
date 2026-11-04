# CHAT

只读页面配置：消息长度、工具显示名称、56px顶部高度及960px正文上限。CHAT.content以CSSProperties约束正文和输入区共用的居中布局，两侧各留32px；滚动视口本身不限制宽度。模型菜单与入口图标尺寸分别为modelMenuIconSize（18px）和modelTriggerIconSize（20px），不包含模型选择状态或其他可变状态。

modeConfirmationWidth（720px）为模式切换确认弹窗的桌面宽度，窄屏由Ant Design原生Modal适配。

spacing统一Agent内容节奏：block=middle（原生16px）用于文字/表格/代码/卡片和独立区块，detail=small（原生8px）用于同组元数据、标签/参数和按钮。外层容器负责间距，子组件不重复追加外边距。

blockFrame 定义表格与代码块共用的满宽外框，沿用工作区边框色与 Ant Design 大圆角，内容在圆角内裁切。

roundSwitch集中轮次切换加载时长（180ms）、末尾判定容差（2px）及右侧导航在宽屏下相对于正文边缘的定位偏移（120px）。只控制本地展示，不影响持久历史和服务端读取。
sidebarLayout集中会话栏默认232px、最小200px、最大560px、主区最小520px与键盘步长24px。
composerResize集中输入区拖拽高度边界、聊天预留高度、键盘步长与顶部手柄高度。
