// Package service ConnectionRepository/Database 为本层声明的接口；注册表按协议分派，编排连接、结构与 SQL。
//
// 查询默认 1000 行/最大 5000 行、30 秒、4 并发，元数据 10 秒；不依赖 Gin、SQL 驱动或文件系统。
package service
