# Agent 页面入口

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

在 SQL Studio 内组合 Agent 功能，仅接收 `themeMode`；页面切换、主题和系统设置由全局 [AppRail](../../components/appRail/README.md) 承载。记录由独立 Go 模块保存，内容见 [Agent 实现](../../agent/README.md)。退出回到工作区不会清除 SQL 草稿。

首次布局恢复使用 ContentLoading。Electron 最上方的标题栏由 App 统一渲染，显示当前语言的「AI 助手」并同步系统窗口标题；加载页和聊天页只负责上下文 Header、内容区与错误展示。失败通过共享 ErrorNotice 在 Header 下方展示，支持手动重试。外观配置错误与布局错误合并去重。

会话加载、执行或历史切换期间通过 [navigationLock](../../contexts/navigationLock/README.md) 暂停 Rail 页面切换，避免未完成操作被切走。