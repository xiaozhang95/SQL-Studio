package chat

import (
	"context"
	"encoding/json"
	"errors"
	model "sql-studio-backend/internal/model/agent"
	"strings"
)

type WriteDatabase interface {
	Write(context.Context, model.Target, string) (json.RawMessage, error)
}

// Full mode permits non-delete data and schema operations. Reject multi-statement,
// executable comments, routines and dynamic SQL that could bypass delete checks.
func ValidateWriteSQL(sql string) error {
	deny := errors.New("完全访问模式仍禁止删除：DELETE、DROP、TRUNCATE、REPLACE及多语句、存储程序、动态SQL不可执行。仅提供命令和风险提示，由用户自行操作")
	sql = strings.TrimSpace(sql)
	if len(sql) == 0 || len(sql) > 16000 {
		return deny
	}
	var tokens []string
	for i := 0; i < len(sql); {
		c := sql[i]
		if c == '\'' || c == '"' || c == '`' {
			quote := c
			i++
			closed := false
			for i < len(sql) {
				if sql[i] == '\\' {
					return deny
				}
				if sql[i] == quote {
					i++
					if i < len(sql) && sql[i] == quote {
						i++
						continue
					}
					closed = true
					break
				}
				i++
			}
			if !closed {
				return deny
			}
			tokens = append(tokens, "IDENTIFIER")
			continue
		}
		if c == ';' {
			if strings.TrimSpace(sql[i+1:]) != "" {
				return deny
			}
			break
		}
		if c == '$' || c == '#' || (i+1 < len(sql) && ((c == '-' && sql[i+1] == '-') || (c == '/' && sql[i+1] == '*'))) {
			return deny
		}
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' {
			start := i
			i++
			for i < len(sql) && ((sql[i] >= 'a' && sql[i] <= 'z') || (sql[i] >= 'A' && sql[i] <= 'Z') || (sql[i] >= '0' && sql[i] <= '9') || sql[i] == '_') {
				i++
			}
			tokens = append(tokens, strings.ToUpper(sql[start:i]))
			continue
		}
		i++
	}
	if len(tokens) == 0 {
		return deny
	}
	switch tokens[0] {
	case "INSERT", "UPDATE", "CREATE", "ALTER", "COMMENT":
	default:
		return deny
	}
	// Full access covers data and schema objects, not accounts, server settings,
	// extensions or filesystem/replication administration.
	if tokens[0] == "CREATE" || tokens[0] == "ALTER" {
		object := 1
		for object < len(tokens) && (tokens[object] == "TEMP" || tokens[object] == "TEMPORARY" || tokens[object] == "UNIQUE" || tokens[object] == "UNLOGGED" || tokens[object] == "MATERIALIZED" || tokens[object] == "FULLTEXT" || tokens[object] == "SPATIAL") {
			object++
		}
		if object >= len(tokens) {
			return deny
		}
		switch tokens[object] {
		case "DATABASE", "SCHEMA", "TABLE", "VIEW", "INDEX", "SEQUENCE", "TYPE", "DOMAIN":
		default:
			return deny
		}
	}
	for _, token := range tokens {
		switch token {
		case "DELETE", "DROP", "TRUNCATE", "REPLACE", "CALL", "EXEC", "EXECUTE", "PREPARE", "FUNCTION", "PROCEDURE", "TRIGGER", "EVENT", "RULE", "COPY", "LOAD", "OUTFILE", "DUMPFILE", "DISCARD", "DETACH", "IMPORT":
			return deny
		}
	}
	parsed, err := agentSQLTokens(sql)
	if err != nil {
		return err
	}
	relations, err := agentRelations(parsed, "", false)
	if err != nil {
		return err
	}
	return validateAgentCalls(parsed, relations.columnLists)
}

func writeTool() model.Tool {
	return model.Tool{Type: "function", Function: model.ToolDefinition{Name: "execute_write", Description: "完全访问模式可执行单条非删除INSERT/UPDATE/CREATE/ALTER/COMMENT，修改前核对目标和范围。禁止DELETE/DROP/TRUNCATE/REPLACE、存储程序和动态SQL。删除仅给命令与风险提示，由用户自行操作。", Parameters: json.RawMessage(`{"type":"object","properties":{"sql":{"type":"string"}},"required":["sql"],"additionalProperties":false}`)}}
}
