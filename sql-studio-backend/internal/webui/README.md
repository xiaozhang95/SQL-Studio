# 前端静态资源

[包索引](../README.md) · [Electron 打包](../../../sql-studio-electron/README.md#调试与打包)

`Register(router *gin.Engine, directory string) error` 向 Gin 注册前端静态文件路由，不访问数据库、凭据或用户配置。directory 非空时使用指定磁盘目录；为空时，从后端工作目录读取 `../sql-studio-frontend/dist`。Electron 打包版通过 SQLDESK_WEB_DIR 指向随包携带的 runtime/web。显式目录不存在时返回 404，不回退到其他来源。

由 app 调用 Register；入口页和根目录文件使用 Gin StaticFileFS，assets 及其他资源子目录使用 Gin StaticFS；NoRoute 仅处理未知路径，不承载网页。`/`、`/agent`、`/monitor`、`/sync` 提供同一个 index.html，分别作为工作区、AI 助手、监控和同步的历史路由入口，支持直接访问和刷新；`/swagger.html` 提供文档页，`/assets/*` 和其他真实文件按原路径提供。`agent`、`monitor`、`sync` 为保留的页面入口，不被同名生成文件或目录覆盖。仅接受 GET/HEAD，其他方法 405；无 index 的目录、丢失资源或未知路径返回 404，不列目录、不把 HTML 伪装成 JS。HTML 文件和页面入口使用 no-cache，文件范围请求、MIME 和 HEAD 由 Gin 静态文件处理器提供。API 命名空间由 app 优先保留。

桌面打包由 Electron 的 pnpm build 构建前端与 Go 后端，再将网页和后端程序一起分发。本包不参与资源生成，编译和普通测试不要求存在前端 dist。路由只在启动时注册，目录读取失败返回错误；开发版尚无 dist 时保留固定入口路由并返回 404。不依赖业务模块，不持有文件写入或缓存。测试源码覆盖显式目录、静态文件、目录与方法边界。
