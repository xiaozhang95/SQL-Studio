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

func (*Client) ChangeKey(ctx context.Context, connection model.Connection, db int, name string, change model.RedisKeyChange) error {
	client := open(connection, db)
	defer client.Close()
	switch change.Action {
	case "create":
		err := client.SetArgs(ctx, *change.Target, *change.Value, driver.SetArgs{Mode: "NX", TTL: time.Duration(*change.TTL) * time.Second}).Err()
		if errors.Is(err, driver.Nil) {
			return targetExists
		}
		return err
	case "rename":
		changed, err := client.RenameNX(ctx, name, *change.Target).Result()
		if err == nil && !changed {
			return targetExists
		}
		return err
	case "copy":
		changed, err := client.Do(ctx, "COPY", name, *change.Target).Int64()
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
		return editStringKey(ctx, client, name, change)
	default:
		return errors.New("不支持的 Redis 键操作")
	}
}

func editStringKey(ctx context.Context, client *driver.Client, name string, change model.RedisKeyChange) error {
	watched := []string{name}
	if change.Target != nil && *change.Target != name {
		watched = append(watched, *change.Target)
	}
	args := driver.SetArgs{Mode: "XX", KeepTTL: change.TTL == nil}
	if change.TTL != nil {
		args.TTL = time.Duration(*change.TTL) * time.Second
	}
	err := client.Watch(ctx, func(tx *driver.Tx) error {
		kind, err := tx.Type(ctx, name).Result()
		if err != nil {
			return err
		}
		if kind == "none" {
			return missingKey
		}
		if kind != "string" {
			return keyChanged
		}
		current, err := tx.GetRange(ctx, name, 0, previewBytes).Result()
		if err != nil {
			return err
		}
		if len(current) > previewBytes || !utf8.ValidString(current) || (change.Before != nil && current != *change.Before) {
			return keyChanged
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
			pipe.SetArgs(ctx, name, *change.Value, args)
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
