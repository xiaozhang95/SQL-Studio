// Package model 定义业务层、HTTP 层和基础设施共同使用的数据契约。
package model

import "strings"

// Connection 表示数据库连接。Password 仅供保存和服务端连接使用，列表响应须移除密码。
type Connection struct {
	Database    string `json:"database,omitempty"`
	ID          string `json:"id"`
	Type        string `json:"type"`
	TLS         bool   `json:"tls"`
	Name        string `json:"name"`
	Group       string `json:"group,omitempty"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	Username    string `json:"username"`
	Password    string `json:"password,omitempty"`
	HasPassword bool   `json:"hasPassword"`
}

const TypeMySQL = "mysql"
const TypePostgreSQL = "postgresql"
const DefaultConnectionGroup = "默认分组"

// NormalizeConnectionGroup 兼容缺少分组的旧配置，留空时归入默认分组。
func NormalizeConnectionGroup(value string) string {
	if group := strings.TrimSpace(value); group != "" {
		return group
	}
	return DefaultConnectionGroup
}

// 空类型兼容首版存量配置，默认使用 MySQL。
func NormalizeDatabaseType(value string) string {
	if value == "" {
		return TypeMySQL
	}
	return value
}
func SupportedDatabaseType(value string) bool {
	return IsMySQL(value) || NormalizeDatabaseType(value) == TypePostgreSQL
}

func IsMySQL(value string) bool { return NormalizeDatabaseType(value) == TypeMySQL }
