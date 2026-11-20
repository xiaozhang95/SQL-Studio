package connections

import (
	"context"
	"errors"
	"net"
	"strconv"
	"strings"

	"sql-studio-backend/internal/model"
)

// 未支持的连接保留在本地文件中，不作为可用连接返回。
func (s *Service) ListConnections() []model.Connection {
	items := []model.Connection{}
	for _, c := range s.connections.List() {
		if model.SupportedDatabaseType(c.Type) {
			c.Group = model.NormalizeConnectionGroup(c.Group)
			items = append(items, c)
		}
	}
	return items
}

func (s *Service) SaveConnection(c model.Connection) (model.Connection, error) {
	c.Type = model.NormalizeDatabaseType(c.Type)
	c.Group = model.NormalizeConnectionGroup(c.Group)
	if err := validateConnection(&c); err != nil {
		return model.Connection{}, err
	}
	return s.connections.Save(c)
}

func (s *Service) DeleteConnection(id string) error { return s.connections.Delete(id) }

func (s *Service) SetSession(ctx context.Context, id string, database *string, open bool) error {
	if database != nil && strings.TrimSpace(*database) == "" {
		return errors.New("数据库名称不能为空")
	}
	connection, err := s.connections.Get(id)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, connectionTimeout)
	defer cancel()
	return s.database.SetSession(ctx, connection, database, open)
}

// TestConnection 支持编辑时密码留空复用旧密码，但不向客户端返回已保存密码。
func (s *Service) TestConnection(ctx context.Context, c model.Connection) (string, error) {
	c.Type = model.NormalizeDatabaseType(c.Type)
	if err := validateConnection(&c); err != nil {
		return "", err
	}
	if c.ID != "" && (c.Password == "" || (c.RedisMode == model.RedisSentinel && c.RedisSentinelPassword == "")) {
		old, err := s.connections.Get(c.ID)
		if err != nil {
			return "", err
		}
		if c.Password == "" {
			c.Password = old.Password
		}
		if c.RedisMode == model.RedisSentinel && old.RedisMode == model.RedisSentinel && c.RedisSentinelPassword == "" {
			c.RedisSentinelPassword = old.RedisSentinelPassword
		}
	}
	if err := c.ValidateRedisCredentials(); err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(ctx, connectionTimeout)
	defer cancel()
	return s.database.Test(ctx, c)
}

func validateConnection(c *model.Connection) error {
	if !model.SupportedDatabaseType(c.Type) {
		return errors.New("不支持的数据库类型")
	}
	if c.Type == model.TypeGreptimeDB || c.Type == model.TypeRedis {
		if strings.TrimSpace(c.Name) == "" || strings.TrimSpace(c.Host) == "" {
			return errors.New("请填写连接名称和主机")
		}
	} else if strings.TrimSpace(c.Name) == "" || strings.TrimSpace(c.Host) == "" || strings.TrimSpace(c.Username) == "" {
		return errors.New("请填写连接名称、主机和用户名")
	}
	if c.Port < 1 || c.Port > 65535 {
		return errors.New("端口必须在 1–65535 之间")
	}
	if c.Type == model.TypeRedis && c.Database != "" {
		if _, err := strconv.ParseUint(c.Database, 10, 31); err != nil {
			return errors.New("Redis 逻辑库编号无效")
		}
	}
	if c.Type == model.TypeRedis {
		return validateRedisConnection(c)
	}
	c.RedisMode, c.RedisNodes = "", nil
	c.RedisMasterName, c.RedisSentinelUsername, c.RedisSentinelPassword = "", "", ""
	c.HasRedisSentinelPassword = false
	return nil
}

func validateRedisConnection(c *model.Connection) error {
	c.RedisMode = c.RedisModeValue()
	switch c.RedisMode {
	case model.RedisStandalone:
		c.RedisNodes = nil
	case model.RedisSentinel:
		c.RedisMasterName = strings.TrimSpace(c.RedisMasterName)
		c.RedisSentinelUsername = strings.TrimSpace(c.RedisSentinelUsername)
		if c.RedisMasterName == "" {
			return errors.New("请输入 Redis 哨兵监控的主节点名称")
		}
	case model.RedisCluster:
		if db := strings.TrimLeft(c.Database, "0"); db != "" {
			return errors.New("Redis 集群仅支持 DB 0")
		}
		c.Database = "0"
	default:
		return errors.New("Redis 连接模式无效")
	}
	if c.RedisMode != model.RedisSentinel {
		c.RedisMasterName, c.RedisSentinelUsername, c.RedisSentinelPassword = "", "", ""
	}
	c.HasRedisSentinelPassword = false
	nodes := make([]string, 0, len(c.RedisNodes))
	for _, address := range c.RedisNodes {
		host, port, err := net.SplitHostPort(strings.TrimSpace(address))
		number, parseErr := strconv.Atoi(port)
		if err != nil || host == "" || strings.ContainsAny(host, " \t\r\n/@") || parseErr != nil || number < 1 || number > 65535 {
			return errors.New("Redis 节点地址必须为主机:端口")
		}
		address = net.JoinHostPort(host, strconv.Itoa(number))
		nodes = append(nodes, address)
	}
	c.RedisNodes = nodes
	return nil
}
