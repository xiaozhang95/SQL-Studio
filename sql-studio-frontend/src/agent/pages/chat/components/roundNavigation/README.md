# RoundNavigation

受控rounds/activeIndex/onJump；左侧最多24个刻度，悬停显示问题与助手回答摘要，点击切到对应轮。问题列表按钮提供可搜索的Ant Design虚拟Select，全部轮次可访问；当前刻度跟随阅读位置或待加载轮次，无总数。弹层打开状态属于本组件，无请求，无模型摘要生成。窄屏保留导航，弹层宽度受视口限制。
导航使用absolute定位到Transcript的relative容器左边缘；不再固定到屏幕232px位置，侧栏拖拽、窄屏隐藏侧栏和输入框高度调整时都随实际会话区域定位。

刻度按钮布局由 style 提供；刻度当前、悬停、键盘焦点和减弱动画保留在 app.scss，由 aria-current 标记当前轮次。
