package model

import "time"

// MonitorSnapshot contains the read-only statistics for a saved connection.
type MonitorSnapshot struct {
	Database  string          `json:"database"`
	SampledAt time.Time       `json:"sampledAt"`
	Metrics   []MonitorMetric `json:"metrics"`
	Redis     *RedisMonitor   `json:"redis,omitempty"`
	Details   *MonitorDetails `json:"details,omitempty"`
}

// MonitorDetails holds engine-owned, read-only server and database information.
type MonitorDetails struct {
	Version  string           `json:"version"`
	Role     string           `json:"role"`
	Identity string           `json:"identity"`
	Sections []MonitorSection `json:"sections"`
	Warnings []string         `json:"warnings,omitempty"`
}

// SelectMonitorSection preserves a fixed order and omits unavailable fields.
func SelectMonitorSection(key string, metrics []MonitorMetric, keys ...string) MonitorSection {
	section := MonitorSection{Key: key, Fields: make([]MonitorMetric, 0, len(keys))}
	for _, name := range keys {
		for _, metric := range metrics {
			if metric.Key == name {
				section.Fields = append(section.Fields, metric)
				break
			}
		}
	}
	return section
}

type MonitorMetric struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// RedisMonitor contains allowlisted INFO details from the same sample.
type RedisMonitor struct {
	Version   string           `json:"version"`
	Mode      string           `json:"mode"`
	Node      string           `json:"node,omitempty"`
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
