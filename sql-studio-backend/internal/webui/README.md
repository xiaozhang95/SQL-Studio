# 前端静态资源

[包索引](../README.md) · [一键打包](../../../README.md#一键打包)

`Register(router *gin.Engine, directory string) error` 向 Gin 注册前端静态文件路由，不访问数据库、凭据或用户配置。directory 非空时使用指定磁盘目录；为空时，`embedded` 构建使用 Go embed 内嵌的 dist，普通 `go run main.go` / `go build` 从后端工作目录读取 `../sql-studio-frontend/dist`。显式目录不存在时返回 404，不回退到其他来源。

由 app 调用 Register；入口页和根目录文件使用 Gin StaticFileFS，assets 及其他资源子目录使用 Gin StaticFS；NoRoute 仅处理未知路径，不承载网页。`/` 提供 index.html，`/swagger.html` 提供文档页，`/assets/*` 和其他真实文件按原路径提供。仅接受 GET/HEAD，其他方法 405；无 index 的目录、丢失资源或未知路径返回 404，不列目录、不把 HTML 伪装成 JS。HTML 使用 no-cache，文件范围请求、MIME 和 HEAD 由 Gin 静态文件处理器提供。API 命名空间由 app 优先保留。

`build.ps1` 先构建前端并刷新本包生成的 dist，再执行 `go build -tags embedded`。dist 不提交；开发/普通测试不需要生成目录。带标签的编译需要先执行打包脚本，包含全部 dist 文件（含子目录和点文件）；二进制运行不依赖仓库路径或外部 dist。路由只在启动时注册，目录读取失败返回错误；开发版尚无 dist 时保留固定入口路由并返回 404。不依赖业务模块，不持有文件写入或缓存。测试源码覆盖磁盘覆盖、静态文件、目录与方法边界；embedded 标签测试从其他工作目录读取内嵌入口和资源。
