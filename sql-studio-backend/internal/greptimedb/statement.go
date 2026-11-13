package greptimedb

import (
	"errors"
	"regexp"
	"strings"
)

var errSingleStatement = errors.New("GreptimeDB 每次请求只支持一条完整 SQL")

// Match the complete statement, with each comment ending at its first */.
const useGap = `(?:[\x00-\x20]|--[^\r\n]*(?:[\r\n]|$)|/\*(?:[^*]|\*+[^*/])*\*+/)*`

var doubleQuotedUse = regexp.MustCompile(`(?i)^` + useGap + `USE` + useGap + `("(?:[^"]|"")+")` + useGap + `;?` + useGap + `$`)

// GreptimeDB's MySQL wire path accepts backticks around a database name.
// Call only after single-statement validation. Send the canonical form because
// GreptimeDB's wire handler also treats inline comments as part of the name.
func normalizeUse(statement string) string {
	match := doubleQuotedUse.FindStringSubmatch(statement)
	if match == nil {
		return statement
	}
	identifier := match[1]
	database := strings.ReplaceAll(identifier[1:len(identifier)-1], `""`, `"`)
	return "USE " + quoteIdentifier(database)
}

// The server can execute a batch even with the driver's multi-statement option
// disabled. Check the request before opening a connection.
func classifyStatement(statement string, allowWrite bool) (bool, error) {
	words, err := statementWords(statement, false)
	if err != nil {
		return false, err
	}
	escaped, err := statementWords(statement, true)
	if err != nil || strings.Join(words, " ") != strings.Join(escaped, " ") {
		return false, errSingleStatement
	}
	switch words[0] {
	case "SHOW", "DESC", "DESCRIBE", "TQL":
		return true, nil
	case "SELECT", "WITH", "EXPLAIN", "VALUES", "TABLE":
		if !allowWrite {
			for _, word := range words {
				switch word {
				case "INSERT", "UPDATE", "DELETE", "REPLACE", "CREATE", "ALTER", "DROP", "TRUNCATE", "INTO", "COPY", "ADMIN", "CALL", "EXECUTE":
					return false, errors.New("只读查询不允许该语句；写入需通过显式写入操作提交")
				}
			}
		}
		return true, nil
	case "USE":
		return false, nil
	default:
		if !allowWrite {
			return false, errors.New("只读查询不允许该语句；写入需通过显式写入操作提交")
		}
		return false, nil
	}
}

func statementWords(statement string, backslash bool) ([]string, error) {
	var words []string
	depth, ended := 0, false
	for i := 0; i < len(statement); {
		ch := statement[i]
		switch {
		case ch <= ' ':
			i++
			continue
		case strings.HasPrefix(statement[i:], "--"):
			line := strings.IndexAny(statement[i:], "\r\n")
			if line < 0 {
				i = len(statement)
			} else {
				i += line
			}
			continue
		case strings.HasPrefix(statement[i:], "/*"):
			end, ok := commentEnd(statement, i)
			if !ok {
				return nil, errSingleStatement
			}
			i = end
			continue
		}
		if ended {
			return nil, errSingleStatement
		}
		if len(words) == 0 && !wordStart(ch) {
			return nil, errSingleStatement
		}
		switch {
		case ch == ';':
			if depth != 0 {
				return nil, errSingleStatement
			}
			ended = true
			i++
		case ch == '\'' || ch == '"' || ch == '`':
			end, ok := quoteEnd(statement, i, backslash)
			if !ok {
				return nil, errSingleStatement
			}
			i = end
		case ch == '(':
			depth++
			i++
		case ch == ')':
			depth--
			i++
		case wordStart(ch):
			start := i
			for i++; i < len(statement) && (wordStart(statement[i]) || statement[i] >= '0' && statement[i] <= '9'); i++ {
			}
			words = append(words, strings.ToUpper(statement[start:i]))
		default:
			i++
		}
		if depth < 0 {
			return nil, errSingleStatement
		}
	}
	if len(words) == 0 || depth != 0 {
		return nil, errSingleStatement
	}
	return words, nil
}

func wordStart(ch byte) bool {
	return ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch == '_'
}

func commentEnd(statement string, start int) (int, bool) {
	if strings.HasPrefix(statement[start:], "/*!") || strings.HasPrefix(statement[start:], "/*M!") {
		return 0, false
	}
	end := strings.Index(statement[start+2:], "*/")
	if end < 0 || strings.Contains(statement[start+2:start+2+end], "/*") {
		return 0, false
	}
	return start + 4 + end, true
}

func quoteEnd(statement string, start int, backslash bool) (int, bool) {
	quote := statement[start]
	for i := start + 1; i < len(statement); i++ {
		if backslash && statement[i] == '\\' && quote != '`' {
			i++
		} else if statement[i] == quote {
			if i+1 < len(statement) && statement[i+1] == quote {
				i++
			} else {
				return i + 1, true
			}
		}
	}
	return 0, false
}
