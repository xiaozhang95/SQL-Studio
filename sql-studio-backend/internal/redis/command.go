package redis

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	driver "github.com/redis/go-redis/v9"
	"sql-studio-backend/internal/model"
)

func (c *Client) Run(ctx context.Context, connection model.Connection, db int, args []string) (reply model.RedisReply, err error) {
	start := time.Now()
	reply = model.RedisReply{Database: db}
	cmd := strings.ToUpper(args[0])
	ctx, release, err := c.beginRequest(ctx, connection.ID, db)
	if err != nil {
		return reply, err
	}
	defer release()
	var value any
	defer func() {
		if err == nil {
			reply.Result = commandResult(args, value)
			reply.Result.DurationMS = time.Since(start).Milliseconds()
		}
	}()
	switch cmd {
	case "SELECT":
		if connection.RedisModeValue() == model.RedisCluster {
			return reply, &model.StatementError{Cause: errors.New("Redis 集群仅支持 DB 0，不能执行 SELECT 切库")}
		}
		if len(args) != 2 {
			return reply, &model.StatementError{Cause: errors.New("用法：SELECT <逻辑库编号>")}
		}
		selected, err := strconv.ParseUint(args[1], 10, 31)
		if err != nil {
			return reply, &model.StatementError{Cause: errors.New("Redis 逻辑库编号无效")}
		}
		targetCtx, releaseTarget, err := c.beginRequest(ctx, connection.ID, int(selected))
		if err != nil {
			return reply, err
		}
		defer releaseTarget()
		client, closeClient := open(targetCtx, connection, 0)
		defer closeClient()
		if err := client.Do(targetCtx, "SELECT", selected).Err(); err != nil {
			return reply, markCommandError(err)
		}
		value = "OK"
		return model.RedisReply{Database: int(selected), Output: "OK"}, nil
	case "AUTH", "HELLO", "QUIT", "RESET", "MONITOR", "SUBSCRIBE", "PSUBSCRIBE", "SSUBSCRIBE", "UNSUBSCRIBE", "PUNSUBSCRIBE", "SUNSUBSCRIBE",
		"MULTI", "EXEC", "DISCARD", "WATCH", "UNWATCH", "READONLY", "READWRITE", "ASKING", "CLIENT":
		return reply, &model.StatementError{Cause: errors.New("该命令需要独立会话，请使用连接设置、逻辑库切换或发布订阅页面")}
	}
	client, closeClient := open(ctx, connection, db)
	defer closeClient()
	command := make([]any, len(args))
	for i, arg := range args {
		command[i] = arg
	}
	value, err = client.Do(ctx, command...).Result()
	if errors.Is(err, driver.Nil) {
		reply.Output = "(nil)"
		value = nil
		return reply, nil
	}
	if err != nil {
		return reply, markCommandError(err)
	}
	reply.Output, reply.Truncated = preview(value, 128*1024)
	return reply, nil
}

func markCommandError(err error) error {
	var serverError driver.Error
	if !errors.As(err, &serverError) {
		return err
	}
	code, _, _ := strings.Cut(serverError.Error(), " ")
	switch code {
	case "NOAUTH", "WRONGPASS", "LOADING", "MASTERDOWN", "CLUSTERDOWN", "TRYAGAIN":
		return err
	}
	return &model.StatementError{Cause: err}
}
