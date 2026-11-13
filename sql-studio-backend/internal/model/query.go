package model

type QueryRequest struct {
	Schema     string `json:"schema,omitempty"`
	Database   string `json:"database"`
	SQL        string `json:"sql"`
	Limit      int    `json:"limit"`
	AllowWrite bool   `json:"allowWrite"`
	MatchRows  bool   `json:"matchRows,omitempty"`
}

type QueryBatchRequest struct {
	Database   string   `json:"database"`
	Statements []string `json:"statements"`
	AllowWrite bool     `json:"allowWrite"`
	Limit      int      `json:"limit"`
}

type QueryBatchStep struct {
	Index    int          `json:"index"`
	Result   *QueryResult `json:"result,omitempty"`
	Error    string       `json:"error,omitempty"`
	Database *string      `json:"database,omitempty"` // New scope after a successful USE.
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
