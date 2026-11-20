package redis

import (
	"context"
	"errors"
	"testing"

	driver "github.com/redis/go-redis/v9"
	"sql-studio-backend/internal/model"
)

func TestRedisPoolFollowsConnectionAndDatabaseScope(t *testing.T) {
	redis := NewClient()
	connection := model.Connection{ID: "redis-1", Host: "localhost", Port: 6379}
	ctx := context.Background()
	t.Cleanup(func() { _ = redis.SetSession(ctx, connection, nil, false) })

	acquire := func(ctx context.Context, connection model.Connection, db int) (driver.UniversalClient, func()) {
		t.Helper()
		client, release, err := redis.acquirePool(ctx, connection, db)
		if err != nil {
			t.Fatal(err)
		}
		return client, release
	}
	request, cancel := context.WithCancel(ctx)
	first, releaseFirst := acquire(request, connection, 0)
	cancel()
	releaseFirst()
	same, releaseSame := acquire(ctx, connection, 0)
	releaseSame()
	if same != first {
		t.Fatal("cancelling a request discarded its connection pool")
	}

	other, releaseOther := acquire(ctx, connection, 1)
	releaseOther()
	if other == first {
		t.Fatal("logical databases shared a connection pool")
	}
	database := "0"
	if err := redis.SetSession(ctx, connection, &database, false); err != nil {
		t.Fatal(err)
	}
	if _, release, err := redis.acquirePool(ctx, connection, 0); !errors.Is(err, errRedisScopeClosed) {
		if release != nil {
			release()
		}
		t.Fatalf("closed database returned %v", err)
	}
	reused, releaseReused := acquire(ctx, connection, 1)
	releaseReused()
	if reused != other {
		t.Fatal("closing a database discarded another database's pool")
	}

	connection.Port++
	replacement, releaseReplacement := acquire(ctx, connection, 1)
	releaseReplacement()
	if replacement == other {
		t.Fatal("changed Redis settings reused the old pool")
	}
}
