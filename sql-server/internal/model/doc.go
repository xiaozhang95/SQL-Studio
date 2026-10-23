// Package model Connection、QueryRequest/QueryResult、TableRef/Table/Column，以及协议类型判断。
//
// 保持 JSON 字段兼容，表身份包含数据库与 Schema；精确数值使用文本，不能在 HTTP 层转为 float64。
package model
