package model

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"
)

type QueryRequest struct {
	Schema     string `json:"schema,omitempty"`
	Database   string `json:"database"`
	SQL        string `json:"sql"`
	Limit      int    `json:"limit"`
	AllowWrite bool   `json:"allowWrite"`
	MatchRows  bool   `json:"matchRows,omitempty"`
}

type QueryErrorKind string

const (
	QueryErrorCheck      QueryErrorKind = "check"
	QueryErrorUnique     QueryErrorKind = "unique"
	QueryErrorForeignKey QueryErrorKind = "foreign-key"
	QueryErrorRequired   QueryErrorKind = "required"
	QueryErrorValue      QueryErrorKind = "value"
	QueryErrorPermission QueryErrorKind = "permission"
	QueryErrorSyntax     QueryErrorKind = "syntax"
	QueryErrorMissing    QueryErrorKind = "missing"
)

// QueryError carries an engine-independent classification and preserves the original error.
type QueryError struct {
	Kind  QueryErrorKind
	Cause error
}

func (e *QueryError) Error() string { return e.Cause.Error() }
func (e *QueryError) Unwrap() error { return e.Cause }

// StatementError identifies an operation-specific database or command rejection.
type StatementError struct{ Cause error }

func (e *StatementError) Error() string { return e.Cause.Error() }
func (e *StatementError) Unwrap() error { return e.Cause }

func IsStatementError(err error) bool {
	var statement *StatementError
	return errors.As(err, &statement)
}

type QueryBatchRequest struct {
	Schema     string   `json:"schema,omitempty"`
	Database   string   `json:"database"`
	Statements []string `json:"statements"`
	AllowWrite bool     `json:"allowWrite"`
	Limit      int      `json:"limit"`
}

type QueryBatchStep struct {
	Index          int          `json:"index"`
	Result         *QueryResult `json:"result,omitempty"`
	Error          string       `json:"error,omitempty"`
	StatementError bool         `json:"statementError,omitempty"`
	Database       *string      `json:"database,omitempty"` // New scope after a successful USE.
}

type ResultColumn struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type QueryTruncation string

const (
	QueryRowLimit     QueryTruncation = "row-limit"
	QueryByteLimit    QueryTruncation = "byte-limit"
	QueryOversizedRow QueryTruncation = "oversized-row"
)

type QueryCellPreview struct {
	Value     *string `json:"value"`
	Shortened bool    `json:"shortened,omitempty"`
}

// QueryResult 用二维数组保留重复列名，精确整数和 DECIMAL 在驱动层转为字符串。
type QueryResult struct {
	Columns      []ResultColumn     `json:"columns"`
	Rows         [][]any            `json:"rows"`
	RowCount     int                `json:"rowCount"`
	AffectedRows int64              `json:"affectedRows"`
	LastInsertID string             `json:"lastInsertId"`
	DurationMS   int64              `json:"durationMs"`
	Truncated    bool               `json:"truncated"`
	TruncatedBy  QueryTruncation    `json:"truncatedBy,omitempty"`
	RowPreview   []QueryCellPreview `json:"rowPreview,omitempty"`
	IsQuery      bool               `json:"isQuery"`
}

// OmitOversizedRow keeps data rows exact. If no row fits, it supplies a small, separate read-only preview.
func (r *QueryResult) OmitOversizedRow(values []any) {
	r.Truncated = true
	r.TruncatedBy = QueryByteLimit
	if len(r.Rows) != 0 {
		return
	}
	r.TruncatedBy = QueryOversizedRow
	const maxPreviewColumns = 8
	const maxCellBytes = 512
	r.RowPreview = make([]QueryCellPreview, min(len(values), maxPreviewColumns))
	for i := range r.RowPreview {
		if values[i] == nil {
			continue
		}
		value, ok := values[i].(string)
		if !ok {
			value = fmt.Sprint(values[i])
		}
		shortened := len(value) > maxCellBytes
		if shortened {
			end := maxCellBytes
			for end > 0 && !utf8.RuneStart(value[end]) {
				end--
			}
			value = strings.Clone(value[:end])
		}
		r.RowPreview[i] = QueryCellPreview{Value: &value, Shortened: shortened}
	}
}
