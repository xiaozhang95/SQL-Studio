// Package model 定义业务层、HTTP 层和基础设施共同使用的数据契约。
package model

// Connection 表示数据库连接。Password 仅供保存和服务端连接使用，列表响应须移除密码。
type Connection struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	TLS         bool   `json:"tls"`
	Database    string `json:"database,omitempty"`
	Name        string `json:"name"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	Username    string `json:"username"`
	Password    string `json:"password,omitempty"`
	HasPassword bool   `json:"hasPassword"`
}

const (
	TypeMySQL             = "mysql"
	TypeMariaDB           = "mariadb"
	TypePolarDBMySQL      = "polardb-mysql"
	TypePostgreSQL        = "postgresql"
	TypePolarDBPostgreSQL = "polardb-postgresql"
	TypePolarDBOracle     = "polardb-oracle"
)

// 空类型兼容首版存量配置，默认使用 MySQL。
func NormalizeDatabaseType(value string) string {
	if value == "" {
		return TypeMySQL
	}
	return value
}
func SupportedDatabaseType(value string) bool {
	return IsMySQL(value) || IsPostgres(value)
}

func IsMySQL(value string) bool {
	switch NormalizeDatabaseType(value) {
	case TypeMySQL, TypeMariaDB, TypePolarDBMySQL:
		return true
	}
	return false
}

func IsPostgres(value string) bool {
	switch value {
	case TypePostgreSQL, TypePolarDBPostgreSQL, TypePolarDBOracle:
		return true
	}
	return false
}
