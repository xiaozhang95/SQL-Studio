# 页面切换

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

SectionNavigation({destination,onSwitch,switchDisabled?}) 在顶栏左侧操作后用竖线隔开一个入口按钮。destination 为目标页面，取 workspace 或 agent，点击按钮调用 onSwitch。switchDisabled 默认 false，AI 助手在会话执行、管理或初始化期间用它禁用离开。

入口使用 Ant Design text Button，默认无边框，保留悬停、键盘焦点与禁用反馈；分隔线前后间距分别使用 token.marginXXS 和 token.paddingXS，保持紧凑布局。
