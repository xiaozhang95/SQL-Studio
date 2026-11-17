package redis

import (
	"context"
	"math"
	"math/big"
	"sort"
	"strconv"
	"strings"
	"time"

	"sql-studio-backend/internal/model"
)

// Monitor reads one INFO snapshot without scanning keys or changing configuration.
func (c *Client) Monitor(ctx context.Context, connection model.Connection, _ string) (model.MonitorSnapshot, error) {
	ctx, release, err := c.beginRequest(ctx, connection.ID, instanceScope)
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	defer release()
	client, closeClient := open(ctx, connection, 0)
	defer closeClient()
	info, err := client.Info(ctx).Result()
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	values := fields(info)
	order := []struct{ source, key string }{
		{"connected_clients", "connections"},
		{"instantaneous_ops_per_sec", "redis_ops"},
		{"used_memory", "redis_memory_bytes"},
		{"uptime_in_seconds", "uptime"},
		{"total_commands_processed", "redis_commands"},
		{"expired_keys", "redis_expired"},
		{"evicted_keys", "redis_evicted"},
		{"used_memory_rss", "redis_memory_rss_bytes"},
		{"used_memory_peak", "redis_memory_peak_bytes"},
		{"used_memory_dataset", "redis_memory_dataset_bytes"},
		{"used_memory_overhead", "redis_memory_overhead_bytes"},
		{"maxmemory", "redis_memory_max_bytes"},
		{"mem_fragmentation_ratio", "redis_fragmentation_ratio"},
		{"blocked_clients", "redis_blocked_clients"},
		{"maxclients", "redis_max_clients"},
		{"total_connections_received", "redis_total_connections"},
		{"rejected_connections", "redis_rejected_connections"},
		{"total_net_input_bytes", "received_bytes"},
		{"total_net_output_bytes", "sent_bytes"},
		{"keyspace_hits", "redis_hits"},
		{"keyspace_misses", "redis_misses"},
		{"connected_slaves", "redis_replicas"},
		{"pubsub_channels", "redis_pubsub_channels"},
		{"pubsub_patterns", "redis_pubsub_patterns"},
		{"total_error_replies", "redis_error_replies"},
	}
	metrics := make([]model.MonitorMetric, 0, len(order)+4)
	for _, item := range order {
		if value := values[item.source]; value != "" {
			metrics = append(metrics, model.MonitorMetric{Key: item.key, Value: value})
		}
	}
	for _, item := range []struct{ source, key string }{
		{"instantaneous_input_kbps", "redis_input_bytes_per_sec"},
		{"instantaneous_output_kbps", "redis_output_bytes_per_sec"},
	} {
		if rate, err := strconv.ParseFloat(values[item.source], 64); err == nil && rate >= 0 && !math.IsNaN(rate) && !math.IsInf(rate, 0) {
			metrics = append(metrics, model.MonitorMetric{Key: item.key, Value: strconv.FormatFloat(rate*1024, 'f', 3, 64)})
		}
	}
	hits, hitErr := strconv.ParseFloat(values["keyspace_hits"], 64)
	misses, missErr := strconv.ParseFloat(values["keyspace_misses"], 64)
	if hitErr == nil && missErr == nil && hits >= 0 && misses >= 0 && hits+misses > 0 {
		metrics = append(metrics, model.MonitorMetric{Key: "cache_hit_percent", Value: strconv.FormatFloat(100*hits/(hits+misses), 'f', 1, 64)})
	}
	detail := redisMonitorDetails(values)
	// An absent keyspace section is unknown, while a present empty section is zero.
	if strings.Contains("\n"+info, "\n# Keyspace") {
		detail.Keyspaces = redisMonitorKeyspaces(values)
		total := new(big.Int)
		for _, database := range detail.Keyspaces {
			if count, ok := new(big.Int).SetString(database.Keys, 10); ok {
				total.Add(total, count)
			}
		}
		metrics = append(metrics, model.MonitorMetric{Key: "redis_keys", Value: total.String()})
	}
	return model.MonitorSnapshot{SampledAt: time.Now().UTC(), Metrics: metrics, Redis: &detail}, nil
}

func redisMonitorDetails(values map[string]string) model.RedisMonitor {
	detail := model.RedisMonitor{Version: values["redis_version"], Mode: values["redis_mode"], Role: values["role"], RunID: values["run_id"], Sections: make([]model.MonitorSection, 0)}
	// Keep server paths and arbitrary module output out of the monitoring response.
	groups := []struct {
		key    string
		fields []string
	}{
		{"server", []string{"redis_version", "redis_mode", "os", "arch_bits", "process_id", "tcp_port", "uptime_in_seconds", "hz", "io_threads_active"}},
		{"clients", []string{"connected_clients", "maxclients", "blocked_clients", "tracking_clients", "client_recent_max_input_buffer", "client_recent_max_output_buffer"}},
		{"memory", []string{"used_memory", "used_memory_rss", "used_memory_peak", "used_memory_dataset", "used_memory_overhead", "maxmemory", "maxmemory_policy", "mem_fragmentation_ratio", "allocator_frag_ratio", "active_defrag_running"}},
		{"persistence", []string{"loading", "rdb_changes_since_last_save", "rdb_bgsave_in_progress", "rdb_last_save_time", "rdb_last_bgsave_status", "rdb_last_bgsave_time_sec", "aof_enabled", "aof_rewrite_in_progress", "aof_last_bgrewrite_status", "aof_last_write_status", "aof_current_size", "aof_base_size"}},
		{"replication", []string{"role", "connected_slaves", "master_link_status", "master_last_io_seconds_ago", "master_sync_in_progress", "slave_read_only", "master_repl_offset", "slave_repl_offset", "repl_backlog_size"}},
		{"stats", []string{"total_connections_received", "total_commands_processed", "instantaneous_ops_per_sec", "total_net_input_bytes", "total_net_output_bytes", "instantaneous_input_kbps", "instantaneous_output_kbps", "rejected_connections", "expired_keys", "evicted_keys", "keyspace_hits", "keyspace_misses", "pubsub_channels", "pubsub_patterns", "total_error_replies", "latest_fork_usec"}},
		{"cpu", []string{"used_cpu_sys", "used_cpu_user", "used_cpu_sys_children", "used_cpu_user_children"}},
	}
	for _, group := range groups {
		section := model.MonitorSection{Key: group.key}
		for _, key := range group.fields {
			if value := values[key]; value != "" {
				section.Fields = append(section.Fields, model.MonitorMetric{Key: key, Value: value})
			}
		}
		if len(section.Fields) > 0 {
			detail.Sections = append(detail.Sections, section)
		}
	}
	return detail
}

func redisMonitorKeyspaces(values map[string]string) []model.RedisKeyspace {
	databases := make([]model.RedisKeyspace, 0)
	for name, value := range values {
		if !strings.HasPrefix(name, "db") {
			continue
		}
		if _, err := strconv.ParseUint(strings.TrimPrefix(name, "db"), 10, 31); err != nil {
			continue
		}
		parts := make(map[string]string)
		for _, pair := range strings.Split(value, ",") {
			if key, text, ok := strings.Cut(pair, "="); ok {
				parts[key] = text
			}
		}
		if count, ok := new(big.Int).SetString(parts["keys"], 10); !ok || count.Sign() < 0 {
			continue
		}
		databases = append(databases, model.RedisKeyspace{Database: name, Keys: parts["keys"], Expires: parts["expires"], AverageTTLMS: parts["avg_ttl"]})
	}
	sort.Slice(databases, func(i, j int) bool {
		left, _ := strconv.Atoi(strings.TrimPrefix(databases[i].Database, "db"))
		right, _ := strconv.Atoi(strings.TrimPrefix(databases[j].Database, "db"))
		return left < right
	})
	return databases
}
