package mysql

import "strings"

func quoteIdentifier(s string) string { return "`" + strings.ReplaceAll(s, "`", "``") + "`" }

func firstKeyword(s string) string {
	for {
		s = strings.TrimSpace(s)
		if strings.HasPrefix(s, "--") || strings.HasPrefix(s, "#") {
			if i := strings.IndexByte(s, '\n'); i >= 0 {
				s = s[i+1:]
				continue
			}
			return ""
		}
		if strings.HasPrefix(s, "/*") {
			if i := strings.Index(s, "*/"); i >= 0 {
				prefix := 0
				if strings.HasPrefix(s, "/*!") {
					prefix = 3
				}
				if strings.HasPrefix(s, "/*M!") {
					prefix = 4
				}
				if prefix > 0 {
					inner := strings.TrimSpace(s[prefix:i])
					inner = strings.TrimLeft(inner, "0123456789")
					if keyword := firstKeyword(inner); keyword != "" {
						return keyword
					}
				}
				s = s[i+2:]
				continue
			}
			return ""
		}
		break
	}
	end := 0
	for end < len(s) && ((s[end] >= 'a' && s[end] <= 'z') || (s[end] >= 'A' && s[end] <= 'Z')) {
		end++
	}
	return strings.ToUpper(s[:end])
}

// 分类决定调用 QueryContext 还是 ExecContext；读查询仍需数据库只读事务保护。
func isQuery(s string) bool {
	keyword := firstKeyword(s)
	if keyword == "WITH" {
		keyword = cteStatementKeyword(s)
	}
	switch keyword {
	case "SELECT", "SHOW", "DESC", "DESCRIBE", "EXPLAIN", "TABLE", "VALUES":
		return true
	}
	return false
}

// 只读事务不能阻止会隐式提交的 DDL。仅接受查询及 USE，并拒绝可能改变语句含义的版本注释。
func isReadOnlyStatement(s string) bool {
	if hasExecutableComment(s, true) || hasExecutableComment(s, false) {
		return false
	}
	return isQuery(s) || firstKeyword(s) == "USE"
}

// 同时按默认转义与 NO_BACKSLASH_ESCAPES 扫描，遇到有歧义的可执行注释保守拒绝。
func hasExecutableComment(s string, backslashEscapes bool) bool {
	var quote byte
	for i := 0; i < len(s); i++ {
		if quote != 0 {
			if backslashEscapes && s[i] == '\\' {
				i++
			} else if s[i] == quote {
				if i+1 < len(s) && s[i+1] == quote {
					i++
				} else {
					quote = 0
				}
			}
			continue
		}
		if s[i] == '\'' || s[i] == '"' || s[i] == '`' {
			quote = s[i]
			continue
		}
		if s[i] == '#' || (s[i] == '-' && i+2 < len(s) && s[i+1] == '-' && s[i+2] <= ' ') {
			for i < len(s) && s[i] != '\n' && s[i] != '\r' {
				i++
			}
			continue
		}
		if s[i] == '/' && i+1 < len(s) && s[i+1] == '*' {
			if i+2 < len(s) && (s[i+2] == '!' || (i+3 < len(s) && s[i+2] == 'M' && s[i+3] == '!')) {
				return true
			}
			end := strings.Index(s[i+2:], "*/")
			if end < 0 {
				return false
			}
			i += end + 3
		}
	}
	return false
}

func cteStatementKeyword(s string) string {
	for _, token := range topLevelKeywords(s) {
		switch token {
		case "SELECT", "UPDATE", "DELETE", "INSERT", "REPLACE", "TABLE", "VALUES":
			return token
		}
	}
	return ""
}

// MariaDB 写入的 RETURNING 结果必须读取列和行；只读分类仍单独校验。
func hasReturning(s string) bool {
	kind := firstKeyword(s)
	if kind != "INSERT" && kind != "DELETE" && kind != "REPLACE" {
		return false
	}
	for _, token := range topLevelKeywords(s) {
		if token == "RETURNING" {
			return true
		}
	}
	return false
}

func topLevelKeywords(s string) []string {
	var tokens []string
	depth := 0
	for i := 0; i < len(s); {
		if s[i] == '\'' || s[i] == '"' || s[i] == '`' {
			quote := s[i]
			i++
			for i < len(s) {
				if s[i] == '\\' {
					i += 2
					continue
				}
				if s[i] == quote {
					i++
					if i < len(s) && s[i] == quote {
						i++
						continue
					}
					break
				}
				i++
			}
			continue
		}
		if s[i] == '#' || (s[i] == '-' && i+1 < len(s) && s[i+1] == '-') {
			for i < len(s) && s[i] != '\n' {
				i++
			}
			continue
		}
		if s[i] == '/' && i+1 < len(s) && s[i+1] == '*' {
			end := strings.Index(s[i+2:], "*/")
			if end < 0 {
				return tokens
			}
			i += end + 4
			continue
		}
		if s[i] == '(' {
			depth++
			i++
			continue
		}
		if s[i] == ')' {
			depth--
			i++
			continue
		}
		if (s[i] >= 'a' && s[i] <= 'z') || (s[i] >= 'A' && s[i] <= 'Z') || s[i] == '_' {
			start := i
			for i < len(s) && ((s[i] >= 'a' && s[i] <= 'z') || (s[i] >= 'A' && s[i] <= 'Z') || (s[i] >= '0' && s[i] <= '9') || s[i] == '_') {
				i++
			}
			if depth == 0 {
				tokens = append(tokens, strings.ToUpper(s[start:i]))
			}
			continue
		}
		i++
	}
	return tokens
}
