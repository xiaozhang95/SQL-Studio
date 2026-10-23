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

// 分类仅决定调用 QueryContext 还是 ExecContext，只读权限始终由 MySQL 事务保证。
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

func cteStatementKeyword(s string) string {
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
				return ""
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
				token := strings.ToUpper(s[start:i])
				switch token {
				case "SELECT", "UPDATE", "DELETE", "INSERT", "REPLACE", "TABLE", "VALUES":
					return token
				}
			}
			continue
		}
		i++
	}
	return ""
}
