package redis

import (
	"context"
	"errors"
	"time"
	"unicode/utf8"

	driver "github.com/redis/go-redis/v9"
	"sql-studio-backend/internal/model"
)

var missingKey = errors.New("Redis 键已不存在")
var keyChanged = errors.New("Redis 键已变更，请刷新后重试")
var targetExists = errors.New("Redis 目标键已存在")

func (c *Client) ChangeKey(ctx context.Context, connection model.Connection, db int, name string, change model.RedisKeyChange) error {
	ctx, release, err := c.beginRequest(ctx, connection.ID, db)
	if err != nil {
		return err
	}
	defer release()
	client, closeClient := open(ctx, connection, db)
	defer closeClient()
	switch change.Action {
	case "create":
		err := client.SetArgs(ctx, *change.Target, *change.Value, driver.SetArgs{Mode: "NX", TTL: time.Duration(*change.TTL) * time.Second}).Err()
		if errors.Is(err, driver.Nil) {
			return targetExists
		}
		return err
	case "rename":
		if change.TTL != nil {
			return renameKeyWithTTL(ctx, client, name, *change.Target, *change.TTL)
		}
		changed, err := client.RenameNX(ctx, name, *change.Target).Result()
		if err == nil && !changed {
			return targetExists
		}
		return err
	case "copy":
		changed, err := keyedCommand(ctx, client, "COPY", name, *change.Target).Int64()
		if err == nil && changed == 0 {
			return errors.New("Redis 源键已不存在或目标键已存在")
		}
		return err
	case "delete":
		removed, err := client.Unlink(ctx, name).Result()
		if err == nil && removed == 0 {
			return missingKey
		}
		return err
	case "ttl":
		if *change.TTL > 0 {
			updated, err := client.Expire(ctx, name, time.Duration(*change.TTL)*time.Second).Result()
			if err == nil && !updated {
				return missingKey
			}
			return err
		}
		updated, err := client.Persist(ctx, name).Result()
		if err != nil || updated {
			return err
		}
		exists, err := client.Exists(ctx, name).Result()
		if err == nil && exists == 0 {
			return missingKey
		}
		return err
	case "value":
		return editKeyValue(ctx, client, name, change)
	default:
		return errors.New("不支持的 Redis 键操作")
	}
}

// 改名与过期时间一起提交，监视两个键以保留目标已存在时的拒绝覆盖语义。
func renameKeyWithTTL(ctx context.Context, client driver.UniversalClient, name, target string, ttl int64) error {
	err := client.Watch(ctx, func(tx *driver.Tx) error {
		exists, err := tx.Exists(ctx, name).Result()
		if err != nil {
			return err
		}
		if exists == 0 {
			return missingKey
		}
		exists, err = tx.Exists(ctx, target).Result()
		if err != nil {
			return err
		}
		if exists != 0 {
			return targetExists
		}
		_, err = tx.TxPipelined(ctx, func(pipe driver.Pipeliner) error {
			pipe.RenameNX(ctx, name, target)
			if ttl == 0 {
				pipe.Persist(ctx, target)
			} else {
				pipe.Expire(ctx, target, time.Duration(ttl)*time.Second)
			}
			return nil
		})
		return err
	}, name, target)
	if errors.Is(err, driver.TxFailedErr) {
		return keyChanged
	}
	return err
}

func editKeyValue(ctx context.Context, client driver.UniversalClient, name string, change model.RedisKeyChange) error {
	valueType := change.ValueType
	if valueType == "" {
		valueType = "string"
	}
	var next collectionValue
	var err error
	if valueType != "string" {
		next, err = parseCollectionValue(valueType, *change.Value)
		if err != nil {
			return err
		}
	}
	watched := []string{name}
	if change.Target != nil && *change.Target != name {
		watched = append(watched, *change.Target)
	}
	args := driver.SetArgs{Mode: "XX", KeepTTL: change.TTL == nil}
	if change.TTL != nil {
		args.TTL = time.Duration(*change.TTL) * time.Second
	}
	err = client.Watch(ctx, func(tx *driver.Tx) error {
		kind, err := tx.Type(ctx, name).Result()
		if err != nil {
			return err
		}
		if kind == "none" {
			return missingKey
		}
		if kind != valueType {
			return keyChanged
		}
		var current collectionValue
		if kind == "string" {
			text, err := tx.GetRange(ctx, name, 0, previewBytes).Result()
			if err != nil {
				return err
			}
			if len(text) > previewBytes || !utf8.ValidString(text) || (change.Before != nil && text != *change.Before) {
				return keyChanged
			}
		} else {
			current, err = readCollectionValue(ctx, tx, kind, name)
			if err != nil {
				return err
			}
			if !current.editable || change.Before == nil || current.text != *change.Before {
				return keyChanged
			}
		}
		if len(watched) == 2 {
			exists, err := tx.Exists(ctx, watched[1]).Result()
			if err != nil {
				return err
			}
			if exists != 0 {
				return targetExists
			}
		}
		_, err = tx.TxPipelined(ctx, func(pipe driver.Pipeliner) error {
			if kind == "string" {
				pipe.SetArgs(ctx, name, *change.Value, args)
			} else {
				applyCollectionValue(ctx, pipe, name, current, next)
				if change.TTL != nil {
					if *change.TTL == 0 {
						pipe.Persist(ctx, name)
					} else {
						pipe.Expire(ctx, name, time.Duration(*change.TTL)*time.Second)
					}
				}
			}
			if len(watched) == 2 {
				pipe.RenameNX(ctx, name, watched[1])
			}
			return nil
		})
		return err
	}, watched...)
	if errors.Is(err, driver.Nil) {
		return missingKey
	}
	if errors.Is(err, driver.TxFailedErr) {
		return keyChanged
	}
	return err
}
