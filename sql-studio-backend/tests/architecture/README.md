# 架构约束

按实际包路径递归解析非测试源码 imports，限制 Gin、数据库驱动与文件访问的层级。connections、metadata、query 业务模块只能依赖 model，不允许兄弟模块、具体仓库或引擎导入；仅 app 组合具体实现。新增包必须声明依赖。

递归检查每个实际内部包的 README.md 与 doc.go，目录索引可以不包含 Go 源码。

由 `go test ./...` 运行，不访问真实数据库。
