package redis

import (
	"reflect"
	"strings"
	"testing"
)

func TestCommandResultPreservesRedisValues(t *testing.T) {
	tests := []struct {
		args  []string
		value any
		names []string
		rows  [][]any
	}{
		{[]string{"GET", "missing"}, nil, []string{"value"}, [][]any{{nil}}},
		{[]string{"INCR", "n"}, int64(9007199254740993), []string{"value"}, [][]any{{"9007199254740993"}}},
		{[]string{"MGET", "a", "b"}, []any{"", nil}, []string{"key", "value"}, [][]any{{"a", ""}, {"b", nil}}},
		{[]string{"HGETALL", "h"}, []any{"a", "b"}, []string{"field", "value"}, [][]any{{"a", "b"}}},
		{[]string{"ZRANGEBYSCORE", "z", "0", "1", "WITHSCORES", "LIMIT", "0", "1"}, []any{"a", "0.5"}, []string{"member", "score"}, [][]any{{"a", "0.5"}}},
	}
	for _, tc := range tests {
		t.Run(tc.args[0], func(t *testing.T) {
			got := commandResult(tc.args, tc.value)
			var names []string
			for _, column := range got.Columns {
				names = append(names, column.Name)
			}
			if !reflect.DeepEqual(names, tc.names) || !reflect.DeepEqual(got.Rows, tc.rows) {
				t.Fatalf("columns %v rows %v", names, got.Rows)
			}
		})
	}
}

func TestCommandResultLimits(t *testing.T) {
	values := make([]any, commandResultRows+1)
	for i := range values {
		values[i] = "foo"
	}
	got := commandResult([]string{"LRANGE", "list", "0", "-1"}, values)
	if !got.Truncated || got.RowCount != commandResultRows {
		t.Fatalf("unexpected limit: %v rows, truncated=%v", got.RowCount, got.Truncated)
	}
	got = commandResult([]string{"GET", "large"}, strings.Repeat("a", commandResultBytes+1))
	if !got.Truncated || got.RowCount != 1 || len(got.Rows[0][0].(string)) > commandResultBytes {
		t.Fatal("expected a bounded scalar result")
	}
}
