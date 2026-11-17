package model

import "time"

// MonitorSnapshot contains the read-only statistics for a saved connection.
type MonitorSnapshot struct {
	Database  string          `json:"database"`
	SampledAt time.Time       `json:"sampledAt"`
	Metrics   []MonitorMetric `json:"metrics"`
	Redis     *RedisMonitor   `json:"redis,omitempty"`
}

type MonitorMetric struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// RedisMonitor contains allowlisted INFO details from the same sample.
type RedisMonitor struct {
	Version   string           `json:"version"`
	Mode      string           `json:"mode"`
	Role      string           `json:"role"`
	RunID     string           `json:"runId"`
	Sections  []MonitorSection `json:"sections"`
	Keyspaces []RedisKeyspace  `json:"keyspaces"`
}

type MonitorSection struct {
	Key    string          `json:"key"`
	Fields []MonitorMetric `json:"fields"`
}

// Counts remain decimal strings, including the average TTL in milliseconds.
type RedisKeyspace struct {
	Database     string `json:"database"`
	Keys         string `json:"keys"`
	Expires      string `json:"expires"`
	AverageTTLMS string `json:"averageTtlMillis"`
}
