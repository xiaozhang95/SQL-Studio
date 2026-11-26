// Package model 定义业务层、HTTP 层和基础设施共同使用的数据契约。
package model

import (
	"errors"
	"regexp"
	"strings"
)

// Connection 表示数据库连接。Password 仅供保存和服务端连接使用，列表响应须移除密码。
type Connection struct {
	Database                 string   `json:"database,omitempty"`
	ID                       string   `json:"id"`
	Type                     string   `json:"type"`
	TLS                      bool     `json:"tls"`
	Name                     string   `json:"name"`
	Group                    string   `json:"group,omitempty"`
	Host                     string   `json:"host"`
	Port                     int      `json:"port"`
	Username                 string   `json:"username"`
	Password                 string   `json:"password,omitempty"`
	HasPassword              bool     `json:"hasPassword"`
	RedisMode                string   `json:"redisMode,omitempty"`
	RedisNodes               []string `json:"redisNodes,omitempty"`
	RedisMasterName          string   `json:"redisMasterName,omitempty"`
	RedisSentinelUsername    string   `json:"redisSentinelUsername,omitempty"`
	RedisSentinelPassword    string   `json:"redisSentinelPassword,omitempty"`
	HasRedisSentinelPassword bool     `json:"hasRedisSentinelPassword,omitempty"`
}

const TypeMySQL = "mysql"
const TypeMariaDB = "mariadb"
const TypePostgreSQL = "postgresql"
const TypeOracle = "oracle"
const DefaultOracleService = "FREEPDB1"
const TypeGreptimeDB = "greptimedb"
const TypeRedis = "redis"
const RedisStandalone = "standalone"
const RedisSentinel = "sentinel"
const RedisCluster = "cluster"
const DefaultConnectionGroup = "默认分组"

var oracleServiceName = regexp.MustCompile(`^[A-Za-z0-9_$#-]+(?:\.[A-Za-z0-9_$#-]+)*$`)

func ValidOracleService(name string) bool {
	return len(name) <= 255 && oracleServiceName.MatchString(name)
}

func (c Connection) RedisModeValue() string {
	if c.RedisMode == "" {
		return RedisStandalone
	}
	return c.RedisMode
}

func (c Connection) ValidateRedisCredentials() error {
	if c.Type == TypeRedis && c.RedisMode == RedisSentinel {
		if c.Username != "" && c.Username != "default" && c.Password == "" {
			return errors.New("哨兵模式下使用 Redis ACL 用户名时需要填写 Redis 密码")
		}
		if c.RedisSentinelUsername != "" && c.RedisSentinelUsername != "default" && c.RedisSentinelPassword == "" {
			return errors.New("使用哨兵 ACL 用户名时需要填写哨兵密码")
		}
	}
	return nil
}

// NormalizeConnectionGroup 为新建连接的空分组输入选择当前默认分组。
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
	return IsMySQLProtocol(value) || value == TypePostgreSQL || value == TypeOracle || value == TypeRedis
}

func IsMySQL(value string) bool { return NormalizeDatabaseType(value) == TypeMySQL }

// IsMySQLProtocol 只描述协议复用，不改变连接保存的引擎身份。
func IsMySQLProtocol(value string) bool {
	return IsMySQL(value) || value == TypeMariaDB || value == TypeGreptimeDB
}
