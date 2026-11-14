package mysql

import (
	"context"
	"strconv"
	"strings"

	"sql-studio-backend/internal/model"
)

// Monitor uses global status on both MySQL and MariaDB without requiring access
// to performance_schema or to any application table.
func (c *Client) Monitor(ctx context.Context, connection model.Connection, _ string) (model.MonitorSnapshot, error) {
	variables := [...]struct{ name, key string }{
		{"threads_connected", "connections"},
		{"threads_running", "running_threads"},
		{"questions", "queries"},
		{"slow_queries", "slow_queries"},
		{"aborted_connects", "failed_connections"},
		{"bytes_received", "received_bytes"},
		{"bytes_sent", "sent_bytes"},
		{"uptime", "uptime"},
	}
	names := make([]string, len(variables))
	for i, variable := range variables {
		names[i] = "'" + variable.name + "'"
	}
	result, err := c.Execute(ctx, connection, model.QueryRequest{
		SQL:   "SHOW GLOBAL STATUS WHERE LOWER(Variable_name) IN (" + strings.Join(names, ",") + ")",
		Limit: len(variables),
	})
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	values := make(map[string]string, len(result.Rows))
	for _, row := range result.Rows {
		if len(row) != 2 {
			continue
		}
		name, nameOK := row[0].(string)
		value, valueOK := row[1].(string)
		if _, parseErr := strconv.ParseUint(value, 10, 64); nameOK && valueOK && parseErr == nil {
			values[strings.ToLower(name)] = value
		}
	}
	var snapshot model.MonitorSnapshot
	for _, variable := range variables {
		if value, ok := values[variable.name]; ok {
			snapshot.Metrics = append(snapshot.Metrics, model.MonitorMetric{Key: variable.key, Value: value})
		}
	}
	return snapshot, nil
}
