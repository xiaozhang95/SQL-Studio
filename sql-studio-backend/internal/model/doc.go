// Package model Connection、QueryRequest/QueryResult、TableRef/Table/Column，以及MySQL 类型校验。
//
// 保持 JSON 字段兼容，表身份包含数据库与表名；精确数值使用文本，不能在 HTTP 层转为 float64。
package model
