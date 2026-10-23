// Package app 创建连接仓库、MySQL/PostgreSQL 驱动及服务，注入 Gin API，组合静态网页和 HTTP 生命周期。
//
// 只在 app 装配具体实现；启动不覆盖已有连接，取消时有界关闭 HTTP 服务。
package app
