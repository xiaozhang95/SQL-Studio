package model

type QueryRequest struct {
	Database   string `json:"database"`
	Schema     string `json:"schema,omitempty"`
	SQL        string `json:"sql"`
	Limit      int    `json:"limit"`
	AllowWrite bool   `json:"allowWrite"`
}

type ResultColumn struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// QueryResult 用二维数组保留重复列名，精确整数和 DECIMAL 在驱动层转为字符串。
type QueryResult struct {
	Columns      []ResultColumn `json:"columns"`
	Rows         [][]any        `json:"rows"`
	RowCount     int            `json:"rowCount"`
	AffectedRows int64          `json:"affectedRows"`
	LastInsertID string         `json:"lastInsertId"`
	DurationMS   int64          `json:"durationMs"`
	Truncated    bool           `json:"truncated"`
	IsQuery      bool           `json:"isQuery"`
}
