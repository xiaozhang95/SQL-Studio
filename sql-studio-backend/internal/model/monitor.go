package model

import "time"

// MonitorSnapshot contains the read-only statistics for a saved connection.
type MonitorSnapshot struct {
	Database  string          `json:"database"`
	SampledAt time.Time       `json:"sampledAt"`
	Metrics   []MonitorMetric `json:"metrics"`
}

type MonitorMetric struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}
