package postgresql

import (
	"context"
	"errors"

	"sql-studio-backend/internal/model"
)

const monitorSQL = `SELECT current_database()::text,
	numbackends::text,
	xact_commit::text,
	xact_rollback::text,
	pg_catalog.pg_database_size(datid)::text,
	ROUND(100 * blks_hit::numeric / NULLIF(blks_hit::numeric + blks_read, 0), 1)::text,
	deadlocks::text,
	temp_bytes::text,
	(tup_inserted::numeric + tup_updated + tup_deleted)::text
	FROM pg_catalog.pg_stat_database
	WHERE datname = current_database()`

func (c *Client) Monitor(ctx context.Context, connection model.Connection, database string) (model.MonitorSnapshot, error) {
	result, err := c.Execute(ctx, connection, model.QueryRequest{SQL: monitorSQL, Database: database, Limit: 1})
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	keys := [...]string{"connections", "transactions_committed", "transactions_rolled_back", "size_bytes", "cache_hit_percent", "deadlocks", "temp_bytes", "rows_changed"}
	if len(result.Rows) != 1 || len(result.Rows[0]) != len(keys)+1 {
		return model.MonitorSnapshot{}, errors.New("未读取到数据库统计")
	}
	row := result.Rows[0]
	name, _ := row[0].(string)
	snapshot := model.MonitorSnapshot{Database: name}
	for index, key := range keys {
		if value, ok := row[index+1].(string); ok {
			snapshot.Metrics = append(snapshot.Metrics, model.MonitorMetric{Key: key, Value: value})
		}
	}
	return snapshot, nil
}
