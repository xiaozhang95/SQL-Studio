package model

// DatabaseSyncConnection selects one saved connection or request-scoped credentials.
type DatabaseSyncConnection struct {
	ConnectionID string                `json:"connectionId,omitempty"`
	External     *DatabaseSyncExternal `json:"external,omitempty"`
}

type DatabaseSyncExternal struct {
	Type     string `json:"type,omitempty"`
	Database string `json:"database,omitempty"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password,omitempty"`
	TLS      bool   `json:"tls,omitempty"`
}

// DatabaseSyncRequest identifies two endpoints of the same database engine and an unused target name.
type DatabaseSyncRequest struct {
	SourceConnectionID string                `json:"sourceConnectionId,omitempty"`
	SourceExternal     *DatabaseSyncExternal `json:"sourceExternal,omitempty"`
	SourceDatabase     string                `json:"sourceDatabase"`
	TargetConnectionID string                `json:"targetConnectionId,omitempty"`
	TargetExternal     *DatabaseSyncExternal `json:"targetExternal,omitempty"`
	TargetDatabase     string                `json:"targetDatabase"`
	Structure          bool                  `json:"structure"`
	Data               bool                  `json:"data"`
	CreateDatabase     bool                  `json:"createDatabase"`
}

type DatabaseSyncPlan struct {
	Tables       int `json:"tables"`
	SkippedViews int `json:"skippedViews"`
}

// DatabaseSyncProgress counts confirmed writes, including when a later operation fails.
type DatabaseSyncProgress struct {
	Phase        string `json:"phase"`
	Table        string `json:"table,omitempty"`
	Created      bool   `json:"created"`
	Completed    int    `json:"completed"`
	Tables       int    `json:"tables"`
	SkippedViews int    `json:"skippedViews"`
	Rows         int64  `json:"rows"`
}
