package redis

import (
	"context"
	"errors"
	"strconv"

	driver "github.com/redis/go-redis/v9"
	"sql-studio-backend/internal/model"
)

const maxListedDatabases = 65536

// Databases lists configured logical indexes, including databases without keys.
func (c *Client) Databases(ctx context.Context, connection model.Connection) ([]string, error) {
	ctx, release, err := c.beginRequest(ctx, connection.ID, instanceScope)
	if err != nil {
		return nil, err
	}
	defer release()
	client, closeClient := open(ctx, connection, 0)
	defer closeClient()
	config, err := client.ConfigGet(ctx, "databases").Result()
	count, parseErr := strconv.Atoi(config["databases"])
	if err != nil || parseErr != nil || count < 1 {
		conn := client.Conn()
		defer conn.Close()
		count, err = countSelectableDatabases(ctx, conn)
		if err != nil {
			return nil, err
		}
	}
	if count > maxListedDatabases {
		return nil, errors.New("Redis 逻辑库数量超过列表上限")
	}
	names := make([]string, count)
	for index := range names {
		names[index] = strconv.Itoa(index)
	}
	return names, nil
}

// Some Redis services restrict CONFIG. SELECT checks the server's range on a
// private connection, with logarithmic round trips and no keyspace scans.
func countSelectableDatabases(ctx context.Context, conn *driver.Conn) (int, error) {
	low, high := 1, maxListedDatabases+1
	for low < high {
		index := low + (high-low)/2
		err := conn.Select(ctx, index).Err()
		switch {
		case err == nil:
			low = index + 1
		case driver.HasErrorPrefix(err, "DB index is out of range"):
			high = index
		case driver.HasErrorPrefix(err, "NOPERM"), driver.HasErrorPrefix(err, "SELECT is not allowed in cluster mode"):
			// A normal connection starts on DB 0 without issuing SELECT.
			return 1, nil
		default:
			return 0, err
		}
	}
	return low, nil
}
