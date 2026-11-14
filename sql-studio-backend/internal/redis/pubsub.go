package redis

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"sort"
	"time"

	driver "github.com/redis/go-redis/v9"
	"sql-studio-backend/internal/model"
)

func (*Client) Channels(ctx context.Context, connection model.Connection, pattern string) (model.RedisChannels, error) {
	client := open(connection, 0)
	defer client.Close()
	if pattern == "" {
		pattern = "*"
	}
	names, err := client.PubSubChannels(ctx, pattern).Result()
	if err != nil {
		return model.RedisChannels{}, err
	}
	patterns, err := client.PubSubNumPat(ctx).Result()
	if err != nil {
		return model.RedisChannels{}, err
	}
	sort.Strings(names)
	result := model.RedisChannels{Patterns: patterns, Truncated: len(names) > 200, Channels: []model.RedisChannel{}}
	names = names[:min(len(names), 200)]
	if len(names) == 0 {
		return result, nil
	}
	counts, err := client.PubSubNumSub(ctx, names...).Result()
	if err != nil {
		return model.RedisChannels{}, err
	}
	for _, name := range names {
		label, cut := clip(display(name), 1024)
		result.Truncated = result.Truncated || cut
		digest := sha256.Sum256([]byte(name))
		result.Channels = append(result.Channels, model.RedisChannel{Name: label, Ref: hex.EncodeToString(digest[:]), Subscribers: counts[name]})
	}
	return result, nil
}

func (*Client) Subscribe(ctx context.Context, connection model.Connection, channel string, pattern bool, emit func(model.RedisEvent) error) error {
	client := open(connection, 0)
	defer client.Close()
	var subscription *driver.PubSub
	if pattern {
		subscription = client.PSubscribe(ctx, channel)
	} else {
		subscription = client.Subscribe(ctx, channel)
	}
	defer subscription.Close()
	response, err := subscription.ReceiveTimeout(ctx, 5*time.Second)
	if err != nil {
		return err
	}
	if _, ok := response.(*driver.Subscription); !ok {
		return errors.New("Redis 订阅响应无效")
	}
	if err := emit(model.RedisEvent{Type: "ready"}); err != nil {
		return err
	}
	messages := subscription.Channel(driver.WithChannelSize(32))
	heartbeat := time.NewTicker(10 * time.Second)
	defer heartbeat.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-heartbeat.C:
			if err := emit(model.RedisEvent{Type: "heartbeat"}); err != nil {
				return err
			}
		case message, ok := <-messages:
			if !ok {
				return errors.New("Redis 订阅已断开")
			}
			payload, cut := clip(display(message.Payload), previewBytes)
			name, nameCut := clip(display(message.Channel), 1024)
			if err := emit(model.RedisEvent{Type: "message", Channel: name, Payload: payload, Truncated: cut || nameCut}); err != nil {
				return err
			}
		}
	}
}
