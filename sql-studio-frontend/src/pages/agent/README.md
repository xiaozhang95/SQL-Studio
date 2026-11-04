# Agent 页面入口

在SQL Studio内组合Agent功能，复用全局主题，传入themeMode/themePreference/onThemeChange/onBack；记录由独立Go模块保存。内容见[Agent实现](../../agent/README.md)。退出返回原工作区，不清除SQL草稿。

首次布局恢复同样使用ContentLoading，在colorBgContainer底色的页面区域居中展示；不再使用fullscreen Spin遮罩，恢复失败仍展示原错误。
