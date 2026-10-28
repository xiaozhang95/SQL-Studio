# 架构约束

按实际包路径递归解析非测试源码 imports，限制 Gin、数据库驱动与文件访问的层级。connections、metadata、query 业务模块只能依赖 model，不允许兄弟模块、具体仓库或引擎导入；仅 app 组合具体实现。新增包必须声明依赖。

递归检查每个实际内部包的 README.md 与 doc.go，目录索引可以不包含 Go 源码。

由 `go test ./...` 运行，不访问真实数据库。

rowstream 允许依赖 model 和 database/sql，仅提供游标扫描；mysql/postgresql 可依赖它，模块与 HTTP 不得直接导入。各引擎继续独立拼接只读导出 SQL 和管理事务，不共享引擎方言。

workspace 模块仅依赖 model 与自己声明的仓库端口，app 注入 statefile；httpapi 调用公开方法，不读写文件或导入具体存储。
