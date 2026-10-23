// Package postgres PostgreSQL、PolarDB PostgreSQL、PolarDB Oracle 兼容版的 pgx 连接、Schema 元数据和执行。
//
// 不是原生 Oracle 驱动。扩展查询保证单语句；默认只读；文本结果保留精度。DDL 是基础重建，不能当完整 pg_dump。
package postgres
