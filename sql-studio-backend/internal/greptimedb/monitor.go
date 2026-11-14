package greptimedb

import (
	"context"
	"errors"

	"sql-studio-backend/internal/model"
)

const monitorSQL = `SELECT COUNT(DISTINCT t.table_id), COUNT(r.region_id),
	COALESCE(SUM(r.region_rows), 0), COALESCE(SUM(r.disk_size), 0),
	COALESCE(SUM(r.memtable_size), 0), COALESCE(SUM(r.sst_num), 0)
	FROM information_schema.tables t
	LEFT JOIN information_schema.region_statistics r
	ON t.table_id = r.table_id AND r.region_role = 'Leader'
	WHERE t.table_schema = database() AND t.table_type = 'BASE TABLE'`

func (c *Client) Monitor(ctx context.Context, connection model.Connection, database string) (model.MonitorSnapshot, error) {
	if database == "" {
		database = defaultDatabase(connection)
	}
	result, err := c.Execute(ctx, connection, model.QueryRequest{SQL: monitorSQL, Database: database, Limit: 1})
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	keys := [...]string{"tables", "regions", "approximate_rows", "region_disk_bytes", "region_memtable_bytes", "region_sst_files"}
	if len(result.Rows) != 1 || len(result.Rows[0]) != len(keys) {
		return model.MonitorSnapshot{}, errors.New("未读取到数据库统计")
	}
	snapshot := model.MonitorSnapshot{Database: database}
	for index, key := range keys {
		if value, ok := result.Rows[0][index].(string); ok {
			snapshot.Metrics = append(snapshot.Metrics, model.MonitorMetric{Key: key, Value: value})
		}
	}
	return snapshot, nil
}
