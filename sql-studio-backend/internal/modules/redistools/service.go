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
	Keys(context.Context, model.Connection, int, string, string) (model.RedisKeyPage, error)
	Key(context.Context, model.Connection, int, string) (model.RedisKeyDetail, error)
	KeyTTL(context.Context, model.Connection, int, string) (model.RedisKeyTTL, error)
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
	if c.RedisModeValue() == model.RedisCluster && number != 0 {
		return 0, errors.New("Redis 集群仅支持 DB 0")
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
	if len(cursor) > 128 || len(pattern) > 1024 {
		return model.RedisKeyPage{}, errors.New("Redis 游标或筛选条件无效")
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return s.engine.Keys(ctx, c, db, cursor, pattern)
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

func (s *Service) KeyTTL(ctx context.Context, id, database, ref string) (model.RedisKeyTTL, error) {
	c, err := s.connection(id)
	if err != nil {
		return model.RedisKeyTTL{}, err
	}
	db, err := databaseIndex(c, database)
	if err != nil {
		return model.RedisKeyTTL{}, err
	}
	name, err := keyName(ref)
	if err != nil {
		return model.RedisKeyTTL{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return s.engine.KeyTTL(ctx, c, db, name)
}

func keyName(ref string) (string, error) {
	name, err := base64.RawURLEncoding.Strict().DecodeString(ref)
	if err != nil || len(name) > 384*1024 {
		return "", errors.New("Redis 键引用无效")
	}
	return string(name), nil
}

func (s *Service) ChangeKey(ctx context.Context, id, database string, ref *string, change model.RedisKeyChange) (model.RedisKeyChangeResult, error) {
	var result model.RedisKeyChangeResult
	c, err := s.connection(id)
	if err != nil {
		return result, err
	}
	db, err := databaseIndex(c, database)
	if err != nil {
		return result, err
	}
	var name string
	if change.Action != "create" {
		if ref == nil {
			return result, errors.New("Redis 键引用无效")
		}
		name, err = keyName(*ref)
		if err != nil {
			return result, err
		}
	}
	if (change.TTL == nil && (change.Action == "create" || change.Action == "ttl")) || (change.TTL != nil && (*change.TTL < 0 || *change.TTL > 315360000)) {
		return result, errors.New("Redis TTL 秒数无效")
	}
	switch change.Action {
	case "delete", "ttl":
	case "rename", "copy":
		if change.Target == nil || len(*change.Target) > 16*1024 || *change.Target == name {
			return result, errors.New("请输入不同的目标键名")
		}
	case "create", "value":
		if change.Value == nil || len(*change.Value) > 16*1024 || (change.Before != nil && len(*change.Before) > 16*1024) {
			return result, errors.New("Redis 键值超过编辑上限或未提供")
		}
		if change.Action == "value" {
			if change.ValueType == "" {
				change.ValueType = "string"
			}
			switch change.ValueType {
			case "string", "list", "set", "hash", "zset":
			default:
				return result, errors.New("当前 Redis 类型不支持直接编辑")
			}
			if change.ValueType != "string" && change.Before == nil {
				return result, errors.New("请刷新 Redis 键值后再编辑")
			}
		}
		if (change.Action == "create" && (change.Target == nil || *change.Target == "")) || (change.Target != nil && len(*change.Target) > 16*1024) {
			return result, errors.New("Redis 键名无效")
		}
	default:
		return result, errors.New("不支持的 Redis 键操作")
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	if err := s.engine.ChangeKey(ctx, c, db, name, change); err != nil {
		return result, err
	}
	result.OK = true
	if change.Target != nil && (change.Action == "create" || change.Action == "rename" || change.Action == "copy" || change.Action == "value") {
		result.Key = &model.RedisKey{Name: *change.Target, Ref: base64.RawURLEncoding.EncodeToString([]byte(*change.Target))}
	}
	return result, nil
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
		if errors.Is(err, invalidCommand) {
			err = &model.StatementError{Cause: err}
		}
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
