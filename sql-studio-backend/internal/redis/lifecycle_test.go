package redis

import (
	"context"
	"testing"
	"time"

	"sql-studio-backend/internal/model"
)

func TestCloseRedisScopeWaitsForMatchingRequests(t *testing.T) {
	client := NewClient()
	connection := model.Connection{ID: "redis-1"}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	begin := func(id string, db int) (context.Context, func()) {
		t.Helper()
		requestCtx, release, err := client.beginRequest(ctx, id, db)
		if err != nil {
			t.Fatal(err)
		}
		return requestCtx, release
	}
	otherDB, releaseOtherDB := begin(connection.ID, 9)
	otherConnection, releaseOtherConnection := begin("redis-2", 7)
	defer releaseOtherConnection()
	subscription, releaseSubscription := begin(connection.ID, instanceScope)

	closeAndWait := func(database *string, request context.Context, release func()) {
		t.Helper()
		done := make(chan error, 1)
		go func() { done <- client.SetSession(ctx, connection, database, false) }()
		select {
		case <-request.Done():
		case <-ctx.Done():
			t.Fatal("close did not cancel the matching request")
		}
		select {
		case err := <-done:
			release()
			t.Fatalf("close completed before request release: %v", err)
		default:
		}
		release()
		if err := <-done; err != nil {
			t.Fatal(err)
		}
	}

	database := "07"
	request, release := begin(connection.ID, 7)
	closeAndWait(&database, request, release)
	if otherDB.Err() != nil || otherConnection.Err() != nil || subscription.Err() != nil {
		t.Fatal("closing a logical database must preserve other databases, connections and Pub/Sub")
	}
	if _, release, err := client.beginRequest(ctx, connection.ID, 7); err == nil {
		release()
		t.Fatal("closed database accepted another request")
	}

	closeAndWait(nil, subscription, func() {
		releaseOtherDB()
		releaseSubscription()
	})
	if otherDB.Err() == nil {
		t.Fatal("closing a connection must also cancel its logical database requests")
	}
	if otherConnection.Err() != nil {
		t.Fatal("closing a connection must preserve other connections")
	}
	if _, release, err := client.beginRequest(ctx, connection.ID, 9); err == nil {
		release()
		t.Fatal("closed connection accepted another request")
	}
}
