package redistools

import (
	"context"
	"encoding/base64"
	"errors"
	"strconv"
	"strings"
	"time"

	"sql-studio-backend/internal/model"
)

type Repository interface {
	Get(string) (model.Connection, error)
}

type Engine interface {
	Keys(context.Context, model.Connection, int, uint64, string) (model.RedisKeyPage, error)
	Key(context.Context, model.Connection, int, string) (model.RedisKeyDetail, error)
	ChangeKey(context.Context, model.Connection, int, string, model.RedisKeyChange) error
	Run(context.Context, model.Connection, int, []string) (model.RedisReply, error)
	Channels(context.Context, model.Connection, string) (model.RedisChannels, error)
	Subscribe(context.Context, model.Connection, string, bool, func(model.RedisEvent) error) error
}

type Service struct {
	connections Repository
	engine      Engine
}

func New(connections Repository, engine Engine) *Service {
	return &Service{connections: connections, engine: engine}
}

const timeout = 8 * time.Second

func (s *Service) connection(id string) (model.Connection, error) {
	c, err := s.connections.Get(id)
	if err == nil && c.Type != model.TypeRedis {
		err = errors.New("请选择 Redis 连接")
	}
	return c, err
}

func databaseIndex(c model.Connection, value string) (int, error) {
	if value == "" {
		value = c.Database
	}
	if value == "" {
		return 0, nil
	}
	number, err := strconv.ParseUint(value, 10, 31)
	if err != nil {
		return 0, errors.New("Redis 逻辑库编号无效")
	}
	return int(number), nil
}

func (s *Service) Keys(ctx context.Context, id, database, cursor, pattern string) (model.RedisKeyPage, error) {
	c, err := s.connection(id)
	if err != nil {
		return model.RedisKeyPage{}, err
	}
	db, err := databaseIndex(c, database)
	if err != nil {
		return model.RedisKeyPage{}, err
	}
	if cursor == "" {
		cursor = "0"
	}
	position, err := strconv.ParseUint(cursor, 10, 64)
	if err != nil || len(pattern) > 1024 {
		return model.RedisKeyPage{}, errors.New("Redis 游标或筛选条件无效")
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return s.engine.Keys(ctx, c, db, position, pattern)
}

func (s *Service) Key(ctx context.Context, id, database, ref string) (model.RedisKeyDetail, error) {
	c, err := s.connection(id)
	if err != nil {
		return model.RedisKeyDetail{}, err
	}
	db, err := databaseIndex(c, database)
	if err != nil {
		return model.RedisKeyDetail{}, err
	}
	name, err := keyName(ref)
	if err != nil {
		return model.RedisKeyDetail{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return s.engine.Key(ctx, c, db, name)
}

func keyName(ref string) (string, error) {
	name, err := base64.RawURLEncoding.Strict().DecodeString(ref)
	if err != nil || len(name) > 384*1024 {
		return "", errors.New("Redis 键引用无效")
	}
	return string(name), nil
}

func (s *Service) ChangeKey(ctx context.Context, id, database, ref string, change model.RedisKeyChange) error {
	c, err := s.connection(id)
	if err != nil {
		return err
	}
	db, err := databaseIndex(c, database)
	if err != nil {
		return err
	}
	name, err := keyName(ref)
	if err != nil {
		return err
	}
	switch change.Action {
	case "delete":
	case "rename", "copy":
		if change.Target == nil || len(*change.Target) > 16*1024 || *change.Target == name {
			return errors.New("请输入不同的目标键名")
		}
	case "value":
		if change.Value == nil || len(*change.Value) > 16*1024 || (change.Before != nil && len(*change.Before) > 16*1024) {
			return errors.New("Redis 字符串值超过编辑上限或未提供")
		}
	case "ttl":
		if change.TTL == nil || *change.TTL < 0 || *change.TTL > 315360000 {
			return errors.New("Redis TTL 秒数无效")
		}
	default:
		return errors.New("不支持的 Redis 键操作")
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return s.engine.ChangeKey(ctx, c, db, name, change)
}

func (s *Service) Run(ctx context.Context, id, database, command string) (model.RedisReply, error) {
	c, err := s.connection(id)
	if err != nil {
		return model.RedisReply{}, err
	}
	db, err := databaseIndex(c, database)
	if err != nil {
		return model.RedisReply{}, err
	}
	args, err := splitCommand(command)
	if err != nil {
		return model.RedisReply{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return s.engine.Run(ctx, c, db, args)
}

func (s *Service) Channels(ctx context.Context, id, pattern string) (model.RedisChannels, error) {
	c, err := s.connection(id)
	if err != nil {
		return model.RedisChannels{}, err
	}
	if len(pattern) > 1024 {
		return model.RedisChannels{}, errors.New("Redis 频道筛选条件无效")
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return s.engine.Channels(ctx, c, pattern)
}

func (s *Service) Subscribe(ctx context.Context, id, channel string, pattern bool, emit func(model.RedisEvent) error) error {
	c, err := s.connection(id)
	if err != nil {
		return err
	}
	if strings.TrimSpace(channel) == "" || len(channel) > 1024 {
		return errors.New("请输入 Redis 频道或匹配模式")
	}
	return s.engine.Subscribe(ctx, c, channel, pattern, emit)
}
