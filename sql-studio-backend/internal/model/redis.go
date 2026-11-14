package model

type RedisKey struct {
	Name string `json:"name"`
	Ref  string `json:"ref"`
}

type RedisKeyPage struct {
	Keys   []RedisKey `json:"keys"`
	Cursor string     `json:"cursor"`
}

type RedisKeyDetail struct {
	Type      string `json:"type"`
	TTLMillis int64  `json:"ttlMillis"`
	Size      int64  `json:"size"`
	Preview   string `json:"preview"`
	Truncated bool   `json:"truncated"`
	Editable  bool   `json:"editable"`
}

type RedisKeyChange struct {
	Action string  `json:"action"`
	Target *string `json:"target,omitempty"`
	Value  *string `json:"value,omitempty"`
	Before *string `json:"before,omitempty"`
	TTL    *int64  `json:"ttl,omitempty"`
}

type RedisReply struct {
	Database  int    `json:"database"`
	Output    string `json:"output"`
	Truncated bool   `json:"truncated"`
}

type RedisChannel struct {
	Name        string `json:"name"`
	Ref         string `json:"ref"`
	Subscribers int64  `json:"subscribers"`
}

type RedisChannels struct {
	Channels  []RedisChannel `json:"channels"`
	Patterns  int64          `json:"patterns"`
	Truncated bool           `json:"truncated"`
}

type RedisEvent struct {
	Type      string `json:"type"`
	Channel   string `json:"channel,omitempty"`
	Payload   string `json:"payload"`
	Truncated bool   `json:"truncated,omitempty"`
}
