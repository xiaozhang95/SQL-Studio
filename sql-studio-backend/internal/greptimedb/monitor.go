package greptimedb

import (
	"context"
	"errors"

	"sql-studio-backend/internal/model"
)

const monitorSQL = `SELECT COUNT(DISTINCT t.table_id), COUNT(r.region_id),
 CASE WHEN COUNT(t.table_id)=0 THEN 0 ELSE SUM(r.region_rows) END,
 CASE WHEN COUNT(t.table_id)=0 THEN 0 ELSE SUM(r.disk_size) END,
 CASE WHEN COUNT(t.table_id)=0 THEN 0 ELSE SUM(r.memtable_size) END,
 CASE WHEN COUNT(t.table_id)=0 THEN 0 ELSE SUM(r.sst_num) END
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
	keys := []string{"tables", "regions", "approximate_rows", "region_disk_bytes", "region_memtable_bytes", "region_sst_files"}
	if len(result.Rows) != 1 || len(result.Rows[0]) != len(keys) {
		return model.MonitorSnapshot{}, errors.New("未读取到数据库统计")
	}
	snapshot := model.MonitorSnapshot{Database: database, Details: &model.MonitorDetails{Sections: make([]model.MonitorSection, 0)}}
	appendGreptimeMetrics(&snapshot, keys, result.Rows[0])
	catalogFields := make([]model.MonitorMetric, 0)
	build, buildErr := c.Execute(ctx, connection, model.QueryRequest{Database: database, Limit: 1, SQL: "SELECT pkg_version,git_commit_short FROM information_schema.build_info LIMIT 1"})
	if buildErr == nil && len(build.Rows) == 1 && len(build.Rows[0]) == 2 {
		snapshot.Details.Version, _ = build.Rows[0][0].(string)
		if commit, ok := build.Rows[0][1].(string); ok {
			catalogFields = append(catalogFields, model.MonitorMetric{Key: "build_commit", Value: commit})
		}
	} else {
		if ctx.Err() != nil {
			return model.MonitorSnapshot{}, ctx.Err()
		}
		snapshot.Details.Warnings = append(snapshot.Details.Warnings, "版本信息未能读取，基础指标仍可查看。")
	}
	storage, storageErr := c.Execute(ctx, connection, model.QueryRequest{Database: database, Limit: 1, SQL: `SELECT
 SUM(r.manifest_size),SUM(r.sst_size),SUM(r.index_size),
 SUM(r.written_bytes_since_open),SUM(r.query_scanned_bytes),SUM(r.query_cpu_time_millis)
 FROM information_schema.tables t JOIN information_schema.region_statistics r
 ON t.table_id=r.table_id AND r.region_role='Leader'
 WHERE t.table_schema=database() AND t.table_type='BASE TABLE'`})
	if storageErr == nil && len(storage.Rows) == 1 && len(storage.Rows[0]) == 6 {
		appendGreptimeMetrics(&snapshot, []string{"region_manifest_bytes", "region_sst_bytes", "region_index_bytes", "region_written_bytes", "region_scanned_bytes", "region_query_cpu_ms"}, storage.Rows[0])
	} else {
		if ctx.Err() != nil {
			return model.MonitorSnapshot{}, ctx.Err()
		}
		snapshot.Details.Warnings = append(snapshot.Details.Warnings, "扩展运行统计未能读取，部分状态信息不可用。")
	}
	snapshot.Details.Sections = append(snapshot.Details.Sections,
		model.SelectMonitorSection("catalog", append(catalogFields, snapshot.Metrics...), "build_commit", "tables", "regions", "approximate_rows"),
		model.SelectMonitorSection("storage", snapshot.Metrics, "region_disk_bytes", "region_memtable_bytes", "region_sst_files", "region_sst_bytes", "region_index_bytes", "region_manifest_bytes"),
		model.SelectMonitorSection("region_activity", snapshot.Metrics, "region_written_bytes", "region_scanned_bytes", "region_query_cpu_ms"),
	)
	return snapshot, nil
}

func appendGreptimeMetrics(snapshot *model.MonitorSnapshot, keys []string, row []any) {
	for i, key := range keys {
		if value, ok := row[i].(string); ok && value != "" {
			snapshot.Metrics = append(snapshot.Metrics, model.MonitorMetric{Key: key, Value: value})
		}
	}
}
