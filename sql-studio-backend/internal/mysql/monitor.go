package mysql

import (
	"context"
	"math/big"
	"strconv"
	"strings"

	"sql-studio-backend/internal/model"
)

// Monitor reads bounded, allowlisted global status and variables on MySQL/MariaDB.
func (c *Client) Monitor(ctx context.Context, connection model.Connection, _ string) (model.MonitorSnapshot, error) {
	variables := []struct{ name, key string }{
		{"threads_connected", "connections"}, {"threads_running", "running_threads"},
		{"questions", "queries"}, {"slow_queries", "slow_queries"},
		{"aborted_connects", "failed_connections"}, {"aborted_clients", "aborted_clients"},
		{"bytes_received", "received_bytes"}, {"bytes_sent", "sent_bytes"}, {"uptime", "uptime"},
		{"connections", "total_connections"}, {"max_used_connections", "peak_connections"},
		{"threads_created", "threads_created"}, {"threads_cached", "threads_cached"},
		{"created_tmp_tables", "temporary_tables"}, {"created_tmp_disk_tables", "temporary_disk_tables"},
		{"com_select", "select_statements"}, {"com_insert", "insert_statements"},
		{"com_update", "update_statements"}, {"com_delete", "delete_statements"},
		{"innodb_buffer_pool_read_requests", "buffer_read_requests"}, {"innodb_buffer_pool_reads", "buffer_disk_reads"},
		{"innodb_buffer_pool_bytes_data", "buffer_data_bytes"}, {"innodb_buffer_pool_bytes_dirty", "buffer_dirty_bytes"},
		{"innodb_data_read", "innodb_read_bytes"}, {"innodb_data_written", "innodb_written_bytes"},
		{"innodb_row_lock_current_waits", "row_lock_waits"}, {"innodb_row_lock_waits", "total_row_lock_waits"},
		{"innodb_row_lock_time", "row_lock_time_ms"}, {"innodb_log_waits", "innodb_log_waits"},
	}
	names := make([]string, len(variables))
	for i, variable := range variables {
		names[i] = "'" + variable.name + "'"
	}
	result, err := c.Execute(ctx, connection, model.QueryRequest{
		SQL: "SHOW GLOBAL STATUS WHERE LOWER(Variable_name) IN (" + strings.Join(names, ",") + ")", Limit: len(variables),
	})
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	values := monitorVariables(result)
	snapshot := model.MonitorSnapshot{Details: &model.MonitorDetails{Sections: make([]model.MonitorSection, 0)}}
	for _, variable := range variables {
		if value, ok := values[variable.name]; ok {
			if _, err := strconv.ParseUint(value, 10, 64); err == nil {
				snapshot.Metrics = append(snapshot.Metrics, model.MonitorMetric{Key: variable.key, Value: value})
			}
		}
	}
	reads, readsOK := new(big.Rat).SetString(values["innodb_buffer_pool_reads"])
	requests, requestsOK := new(big.Rat).SetString(values["innodb_buffer_pool_read_requests"])
	if readsOK && requestsOK && reads.Sign() >= 0 && requests.Sign() > 0 && reads.Cmp(requests) <= 0 {
		ratio := new(big.Rat).Sub(big.NewRat(1, 1), new(big.Rat).Quo(reads, requests))
		snapshot.Metrics = append(snapshot.Metrics, model.MonitorMetric{Key: "cache_hit_percent", Value: ratio.Mul(ratio, big.NewRat(100, 1)).FloatString(2)})
	}
	if ctx.Err() != nil {
		return model.MonitorSnapshot{}, ctx.Err()
	}
	settings, settingsErr := c.Execute(ctx, connection, model.QueryRequest{
		SQL: "SHOW GLOBAL VARIABLES WHERE LOWER(Variable_name) IN ('version','version_comment','server_id','server_uuid','hostname','max_connections','innodb_buffer_pool_size','innodb_page_size','read_only','wait_timeout','thread_cache_size','table_open_cache','log_bin','slow_query_log','long_query_time')", Limit: 15,
	})
	if settingsErr == nil {
		config := monitorVariables(settings)
		snapshot.Details.Version = config["version"]
		snapshot.Details.Identity = config["server_uuid"]
		if snapshot.Details.Identity == "" && config["hostname"] != "" {
			snapshot.Details.Identity = config["hostname"] + "/" + config["server_id"]
		}
		switch strings.ToLower(config["read_only"]) {
		case "on", "1":
			snapshot.Details.Role = "read-only"
		case "off", "0":
			snapshot.Details.Role = "read-write"
		}
		for _, item := range []struct{ source, key string }{
			{"max_connections", "max_connections"}, {"innodb_buffer_pool_size", "buffer_pool_bytes"},
		} {
			if value := config[item.source]; value != "" {
				snapshot.Metrics = append(snapshot.Metrics, model.MonitorMetric{Key: item.key, Value: value})
			}
		}
		section := model.MonitorSection{Key: "server", Fields: make([]model.MonitorMetric, 0)}
		for _, name := range []string{"version", "version_comment", "server_id", "max_connections", "read_only", "innodb_buffer_pool_size", "innodb_page_size", "wait_timeout", "thread_cache_size", "table_open_cache", "log_bin", "slow_query_log", "long_query_time"} {
			if value := config[name]; value != "" {
				section.Fields = append(section.Fields, model.MonitorMetric{Key: name, Value: value})
			}
		}
		snapshot.Details.Sections = append(snapshot.Details.Sections, section)
	} else {
		if ctx.Err() != nil {
			return model.MonitorSnapshot{}, ctx.Err()
		}
		snapshot.Details.Warnings = append(snapshot.Details.Warnings, "服务器配置未能读取，部分状态信息不可用。")
	}
	snapshot.Details.Sections = append(snapshot.Details.Sections,
		model.SelectMonitorSection("connections", snapshot.Metrics, "connections", "running_threads", "peak_connections", "total_connections", "failed_connections", "aborted_clients", "threads_created", "threads_cached", "uptime"),
		model.SelectMonitorSection("statements", snapshot.Metrics, "queries", "slow_queries", "select_statements", "insert_statements", "update_statements", "delete_statements", "temporary_tables", "temporary_disk_tables"),
		model.SelectMonitorSection("innodb", snapshot.Metrics, "cache_hit_percent", "buffer_data_bytes", "buffer_dirty_bytes", "buffer_pool_bytes", "buffer_read_requests", "buffer_disk_reads", "innodb_read_bytes", "innodb_written_bytes", "row_lock_waits", "total_row_lock_waits", "row_lock_time_ms", "innodb_log_waits"),
		model.SelectMonitorSection("network", snapshot.Metrics, "received_bytes", "sent_bytes"),
	)
	return snapshot, nil
}

func monitorVariables(result model.QueryResult) map[string]string {
	values := make(map[string]string, len(result.Rows))
	for _, row := range result.Rows {
		if len(row) != 2 {
			continue
		}
		name, nameOK := row[0].(string)
		value, valueOK := row[1].(string)
		if nameOK && valueOK {
			values[strings.ToLower(name)] = value
		}
	}
	return values
}
