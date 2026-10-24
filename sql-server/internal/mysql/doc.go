// Package mysql MySQL 的连接测试、结构读取、DDL 与 SQL 执行。
//
// SQL 默认只读事务，单语句执行；结果行数/约 8MiB 限制，保留 BIGINT/DECIMAL 精度与 NULL；标识符严格转义。
package mysql
