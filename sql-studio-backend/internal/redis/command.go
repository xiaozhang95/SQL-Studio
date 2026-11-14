package redis

import (
	"context"
	"errors"
	"strconv"
	"strings"

	driver "github.com/redis/go-redis/v9"
	"sql-studio-backend/internal/model"
)

func (*Client) Run(ctx context.Context, connection model.Connection, db int, args []string) (model.RedisReply, error) {
	reply := model.RedisReply{Database: db}
	cmd := strings.ToUpper(args[0])
	switch cmd {
	case "SELECT":
		if len(args) != 2 {
			return reply, errors.New("用法：SELECT <逻辑库编号>")
		}
		selected, err := strconv.ParseUint(args[1], 10, 31)
		if err != nil {
			return reply, errors.New("Redis 逻辑库编号无效")
		}
		client := open(connection, 0)
		defer client.Close()
		if err := client.Do(ctx, "SELECT", selected).Err(); err != nil {
			return reply, err
		}
		return model.RedisReply{Database: int(selected), Output: "OK"}, nil
	case "AUTH", "HELLO", "QUIT", "RESET", "MONITOR", "SUBSCRIBE", "PSUBSCRIBE", "SSUBSCRIBE", "UNSUBSCRIBE", "PUNSUBSCRIBE", "SUNSUBSCRIBE",
		"MULTI", "EXEC", "DISCARD", "WATCH", "UNWATCH", "READONLY", "READWRITE", "ASKING", "CLIENT":
		return reply, errors.New("该命令需要独立会话，请使用连接设置、逻辑库切换或发布订阅页面")
	}
	client := open(connection, db)
	defer client.Close()
	command := make([]any, len(args))
	for i, arg := range args {
		command[i] = arg
	}
	value, err := client.Do(ctx, command...).Result()
	if errors.Is(err, driver.Nil) {
		reply.Output = "(nil)"
		return reply, nil
	}
	if err != nil {
		return reply, err
	}
	reply.Output, reply.Truncated = preview(value, 128*1024)
	return reply, nil
}
