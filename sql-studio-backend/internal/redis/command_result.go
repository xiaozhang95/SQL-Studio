package redis

import (
	"strconv"
	"strings"

	"sql-studio-backend/internal/model"
)

const commandResultRows = 1000
const commandResultBytes = 128 * 1024

func commandResult(args []string, value any) *model.QueryResult {
	result := &model.QueryResult{IsQuery: true, Rows: make([][]any, 0)}
	result.Columns = []model.ResultColumn{{Name: "value"}}
	budget := commandResultBytes
	appendRow := func(values ...any) bool {
		if len(result.Rows) == commandResultRows || budget <= 0 {
			result.Truncated = true
			return false
		}
		row := make([]any, len(values))
		for index, cell := range values {
			budget = max(0, budget-8)
			var text string
			var truncated bool
			switch v := cell.(type) {
			case nil:
				continue
			case int64:
				text = strconv.FormatInt(v, 10)
			case string:
				text, truncated = clip(display(v), budget)
			default:
				text, truncated = preview(v, budget)
			}
			budget -= len(text)
			result.Truncated = result.Truncated || truncated
			row[index] = text
		}
		result.Rows = append(result.Rows, row)
		result.RowCount = len(result.Rows)
		return true
	}

	if items, ok := value.([]any); ok {
		command := strings.ToUpper(args[0])
		var labels []string
		switch command {
		case "HGETALL":
			result.Columns = []model.ResultColumn{{Name: "field"}, {Name: "value"}}
		case "MGET":
			result.Columns = []model.ResultColumn{{Name: "key"}, {Name: "value"}}
			labels = args[1:]
		case "HMGET":
			result.Columns = []model.ResultColumn{{Name: "field"}, {Name: "value"}}
			labels = args[2:]
		case "ZRANGE", "ZREVRANGE", "ZRANGEBYSCORE", "ZREVRANGEBYSCORE":
			for _, option := range args[min(4, len(args)):] {
				if strings.EqualFold(option, "WITHSCORES") {
					result.Columns = []model.ResultColumn{{Name: "member"}, {Name: "score"}}
					break
				}
			}
		}
		for index := 0; index < len(items); index++ {
			switch {
			case len(result.Columns) == 1:
				if !appendRow(items[index]) {
					return result
				}
			case labels != nil:
				if index >= len(labels) || !appendRow(labels[index], items[index]) {
					return result
				}
			default:
				if index+1 >= len(items) || !appendRow(items[index], items[index+1]) {
					return result
				}
				index++
			}
		}
		return result
	}
	switch value.(type) {
	case int64:
		result.Columns[0].Type = "INTEGER"
	case string:
		result.Columns[0].Type = "STRING"
	}
	appendRow(value)
	return result
}
