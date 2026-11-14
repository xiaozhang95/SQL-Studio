# 数据库功能页布局

`DatabasePage` 为监控和同步页面提供共享顶栏、工作区返回按钮、系统设置和可滚动正文。正文使用可用宽度，左右留白随视口调整。接收已翻译的 `title`、正文 `children`、外观设置及 `onBack`；可选 `backDisabled` 禁用返回按钮。保存连接读取失败时以 `connectionError` 和 `retryConnections` 提供页级错误和重试。业务请求由页面所属 hook 管理。
