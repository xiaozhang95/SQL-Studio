# Agent 页面入口

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

在SQL Studio内组合Agent功能，传入 themeMode、全局 AppearancePreferences（已应用主题、字号、恢复状态和异步统一外观保存回调）及 onBack；记录由独立Go模块保存。内容见[Agent实现](../../agent/README.md)。退出返回原工作区，不清除SQL草稿。

首次布局恢复使用 ContentLoading。恢复期间和聊天页面均由 PageHeader 向 Electron 标题栏传入当前语言的「AI 助手」页面标题，同步系统窗口标题，保留返回工作区和系统设置入口。会话标题由聊天页面的业务顶栏独立展示。失败通过共享 ErrorNotice 在顶栏下方展示，支持手动重试。外观配置错误与布局错误合并去重。
