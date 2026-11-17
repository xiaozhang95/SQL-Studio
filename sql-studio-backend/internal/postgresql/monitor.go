package postgresql

import (
	"context"
	"errors"

	"sql-studio-backend/internal/model"
)

const monitorSQL = `SELECT current_database()::text,
 numbackends::text, xact_commit::text, xact_rollback::text,
 pg_catalog.pg_database_size(datid)::text,
 ROUND(100 * blks_hit::numeric / NULLIF(blks_hit::numeric + blks_read, 0), 1)::text,
 deadlocks::text, temp_bytes::text,
 (tup_inserted::numeric + tup_updated + tup_deleted)::text,
 blks_read::text, blks_hit::text, temp_files::text,
 tup_returned::text, tup_fetched::text, tup_inserted::text, tup_updated::text, tup_deleted::text,
 conflicts::text, blk_read_time::text, blk_write_time::text,
 EXTRACT(EPOCH FROM stats_reset)::text,
 FLOOR(EXTRACT(EPOCH FROM clock_timestamp() - pg_catalog.pg_postmaster_start_time()))::bigint::text,
 pg_catalog.pg_postmaster_start_time()::text || '/' || COALESCE(stats_reset::text,'')
 FROM pg_catalog.pg_stat_database WHERE datname = current_database()`

func (c *Client) Monitor(ctx context.Context, connection model.Connection, database string) (model.MonitorSnapshot, error) {
	result, err := c.Execute(ctx, connection, model.QueryRequest{SQL: monitorSQL, Database: database, Limit: 1})
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	keys := []string{"connections", "transactions_committed", "transactions_rolled_back", "size_bytes", "cache_hit_percent", "deadlocks", "temp_bytes", "rows_changed", "blocks_read", "blocks_hit", "temp_files", "rows_returned", "rows_fetched", "rows_inserted", "rows_updated", "rows_deleted", "conflicts", "block_read_time_ms", "block_write_time_ms", "stats_reset", "uptime"}
	if len(result.Rows) != 1 || len(result.Rows[0]) != len(keys)+2 {
		return model.MonitorSnapshot{}, errors.New("未读取到数据库统计")
	}
	row := result.Rows[0]
	name, _ := row[0].(string)
	identity, _ := row[len(row)-1].(string)
	snapshot := model.MonitorSnapshot{Database: name, Details: &model.MonitorDetails{Identity: identity, Sections: make([]model.MonitorSection, 0)}}
	appendPostgresMetrics(&snapshot, keys, row[1:len(row)-1])
	serverFields := make([]model.MonitorMetric, 0)
	server, serverErr := c.Execute(ctx, connection, model.QueryRequest{Database: database, Limit: 1, SQL: `SELECT
 current_setting('server_version'),
 CASE WHEN pg_catalog.pg_is_in_recovery() THEN 'standby' ELSE 'primary' END,
 current_setting('max_connections'),pg_catalog.pg_size_bytes(current_setting('shared_buffers'))::text,
 pg_catalog.pg_size_bytes(current_setting('work_mem'))::text,
 pg_catalog.pg_size_bytes(current_setting('maintenance_work_mem'))::text,
 pg_catalog.pg_size_bytes(current_setting('effective_cache_size'))::text,
 current_setting('track_io_timing'),current_setting('wal_level'),
 EXTRACT(EPOCH FROM pg_catalog.pg_postmaster_start_time())::text`})
	if serverErr == nil && len(server.Rows) == 1 && len(server.Rows[0]) == 10 {
		fields := server.Rows[0]
		snapshot.Details.Version, _ = fields[0].(string)
		snapshot.Details.Role, _ = fields[1].(string)
		appendPostgresMetrics(&snapshot, []string{"max_connections", "shared_buffers_bytes", "work_mem_bytes", "maintenance_work_mem_bytes", "effective_cache_bytes"}, fields[2:7])
		appendPostgresMetrics(&snapshot, []string{"server_started_at"}, fields[9:])
		for i, key := range []string{"track_io_timing", "wal_level"} {
			if value, ok := fields[i+7].(string); ok {
				serverFields = append(serverFields, model.MonitorMetric{Key: key, Value: value})
			}
		}
	} else {
		if ctx.Err() != nil {
			return model.MonitorSnapshot{}, ctx.Err()
		}
		snapshot.Details.Warnings = append(snapshot.Details.Warnings, "服务器配置未能读取，部分状态信息不可用。")
	}
	activity, activityErr := c.Execute(ctx, connection, model.QueryRequest{Database: database, Limit: 1, SQL: `SELECT
 a.active::text,a.idle::text,a.idle_transaction::text,a.unknown::text,
 l.waiting::text,l.granted::text,
 t.tables::text,t.live::text,t.dead::text,t.sequential::text,t.indexed::text,
 t.autovacuum::text,t.autoanalyze::text
 FROM (SELECT COUNT(*) FILTER (WHERE state='active') AS active,
 COUNT(*) FILTER (WHERE state='idle') AS idle,
 COUNT(*) FILTER (WHERE state IN ('idle in transaction','idle in transaction (aborted)')) AS idle_transaction,
 COUNT(*) FILTER (WHERE state IS NULL) AS unknown
 FROM pg_catalog.pg_stat_activity WHERE datname=current_database()) a
 CROSS JOIN (SELECT COUNT(*) FILTER (WHERE NOT granted) AS waiting,
 COUNT(*) FILTER (WHERE granted) AS granted FROM pg_catalog.pg_locks
 WHERE database=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())) l
 CROSS JOIN (SELECT COUNT(*) AS tables,COALESCE(SUM(n_live_tup),0) AS live,
 COALESCE(SUM(n_dead_tup),0) AS dead,COALESCE(SUM(seq_scan),0) AS sequential,
 COALESCE(SUM(idx_scan),0) AS indexed,COALESCE(SUM(autovacuum_count),0) AS autovacuum,
 COALESCE(SUM(autoanalyze_count),0) AS autoanalyze FROM pg_catalog.pg_stat_user_tables) t`})
	if activityErr == nil && len(activity.Rows) == 1 && len(activity.Rows[0]) == 13 {
		appendPostgresMetrics(&snapshot, []string{"active_sessions", "idle_sessions", "idle_transaction_sessions", "unknown_sessions", "waiting_locks", "granted_locks", "tables", "estimated_live_rows", "estimated_dead_rows", "sequential_scans", "index_scans", "autovacuum_count", "autoanalyze_count"}, activity.Rows[0])
	} else {
		if ctx.Err() != nil {
			return model.MonitorSnapshot{}, ctx.Err()
		}
		snapshot.Details.Warnings = append(snapshot.Details.Warnings, "扩展运行统计未能读取，部分状态信息不可用。")
	}
	snapshot.Details.Sections = append(snapshot.Details.Sections,
		model.SelectMonitorSection("server", append(serverFields, snapshot.Metrics...), "server_started_at", "uptime", "max_connections", "shared_buffers_bytes", "work_mem_bytes", "maintenance_work_mem_bytes", "effective_cache_bytes", "track_io_timing", "wal_level", "stats_reset"),
		model.SelectMonitorSection("sessions", snapshot.Metrics, "connections", "active_sessions", "idle_sessions", "idle_transaction_sessions", "unknown_sessions", "waiting_locks", "granted_locks"),
		model.SelectMonitorSection("transactions", snapshot.Metrics, "transactions_committed", "transactions_rolled_back", "conflicts", "deadlocks"),
		model.SelectMonitorSection("storage", snapshot.Metrics, "size_bytes", "cache_hit_percent", "blocks_read", "blocks_hit", "block_read_time_ms", "block_write_time_ms", "temp_files", "temp_bytes"),
		model.SelectMonitorSection("rows", snapshot.Metrics, "rows_returned", "rows_fetched", "rows_inserted", "rows_updated", "rows_deleted", "rows_changed"),
		model.SelectMonitorSection("maintenance", snapshot.Metrics, "tables", "estimated_live_rows", "estimated_dead_rows", "sequential_scans", "index_scans", "autovacuum_count", "autoanalyze_count"),
	)
	return snapshot, nil
}

func appendPostgresMetrics(snapshot *model.MonitorSnapshot, keys []string, row []any) {
	for i, key := range keys {
		if value, ok := row[i].(string); ok && value != "" {
			snapshot.Metrics = append(snapshot.Metrics, model.MonitorMetric{Key: key, Value: value})
		}
	}
}
