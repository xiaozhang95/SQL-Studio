package service

import (
	"context"
	"errors"
	"strings"

	"sqldesk/internal/model"
)

func (s *Service) ListConnections() []model.Connection { return s.connections.List() }

func (s *Service) SaveConnection(c model.Connection) (model.Connection, error) {
	c.Type = model.NormalizeDatabaseType(c.Type)
	if err := validateConnection(c); err != nil {
		return model.Connection{}, err
	}
	return s.connections.Save(c)
}

func (s *Service) DeleteConnection(id string) error { return s.connections.Delete(id) }

// TestConnection 支持编辑时密码留空复用旧密码，但不向客户端返回已保存密码。
func (s *Service) TestConnection(ctx context.Context, c model.Connection) (string, error) {
	c.Type = model.NormalizeDatabaseType(c.Type)
	if err := validateConnection(c); err != nil {
		return "", err
	}
	if c.ID != "" && c.Password == "" {
		old, err := s.connections.Get(c.ID)
		if err != nil {
			return "", err
		}
		c.Password = old.Password
	}
	ctx, cancel := context.WithTimeout(ctx, connectionTimeout)
	defer cancel()
	return s.database.Test(ctx, c)
}

func validateConnection(c model.Connection) error {
	if !model.SupportedDatabaseType(c.Type) {
		return errors.New("不支持的数据库类型")
	}
	if strings.TrimSpace(c.Name) == "" || strings.TrimSpace(c.Host) == "" || strings.TrimSpace(c.Username) == "" {
		return errors.New("请填写连接名称、主机和用户名")
	}
	if c.Port < 1 || c.Port > 65535 {
		return errors.New("端口必须在 1–65535 之间")
	}
	return nil
}
