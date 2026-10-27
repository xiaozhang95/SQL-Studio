package postgresql

import (
	"errors"
	"regexp"
	"strings"
)

var errRelation = errors.New("表名必须是完整的 schema/table 标识符")

func quoteIdentifier(value string) string { return `"` + strings.ReplaceAll(value, `"`, `""`) + `"` }

var dollarTag = regexp.MustCompile(`^\$(?:[\pL_][\pL\pN_]*)?\$`)

// Classification only chooses result vs command feedback; permissions are enforced by PostgreSQL.
func isQuery(statement string) bool {
	words := topLevelWords(statement)
	if len(words) == 0 {
		return false
	}
	for _, word := range words {
		if word == "RETURNING" {
			return true
		}
	}
	keyword := words[0]
	if keyword == "WITH" {
		for _, word := range words[1:] {
			switch word {
			case "SELECT", "INSERT", "UPDATE", "DELETE", "MERGE", "VALUES", "TABLE":
				keyword = word
				goto classified
			}
		}
	}
classified:
	switch keyword {
	case "SELECT", "VALUES", "TABLE", "SHOW", "EXPLAIN":
		return true
	}
	return false
}
func topLevelWords(s string) []string {
	words := []string{}
	depth := 0
	for i := 0; i < len(s); {
		if i+1 < len(s) && s[i:i+2] == "--" {
			for i < len(s) && s[i] != '\n' && s[i] != '\r' {
				i++
			}
			continue
		}
		if i+1 < len(s) && s[i:i+2] == "/*" {
			level := 1
			i += 2
			for i < len(s) && level > 0 {
				if i+1 < len(s) && s[i:i+2] == "/*" {
					level++
					i += 2
				} else if i+1 < len(s) && s[i:i+2] == "*/" {
					level--
					i += 2
				} else {
					i++
				}
			}
			continue
		}
		if s[i] == '\'' || s[i] == '"' {
			quote := s[i]
			escaped := quote == '\'' && i > 0 && (s[i-1] == 'E' || s[i-1] == 'e') && (i < 2 || !identifierByte(s[i-2]))
			i++
			for i < len(s) {
				if escaped && s[i] == '\\' {
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
		if s[i] == '$' && (i == 0 || !identifierByte(s[i-1])) {
			tag := dollarTag.FindString(s[i:])
			if tag != "" {
				i += len(tag)
				end := strings.Index(s[i:], tag)
				if end < 0 {
					return words
				}
				i += end + len(tag)
				continue
			}
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
		if identifierByte(s[i]) {
			start := i
			for i < len(s) && identifierByte(s[i]) {
				i++
			}
			if depth == 0 {
				words = append(words, strings.ToUpper(s[start:i]))
			}
			continue
		}
		i++
	}
	return words
}
func identifierByte(char byte) bool {
	return char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char >= '0' && char <= '9' || char == '_' || char == '$' || char >= 128
}

// Table names from metadata are always a quoted schema-qualified pair.
// Plain names from API clients resolve in public, never by splitting arbitrary dots.
func relation(value string) (string, string, error) {
	if strings.HasPrefix(value, `"`) {
		parts := []string{}
		for len(value) > 0 {
			if value[0] != '"' {
				break
			}
			value = value[1:]
			var part strings.Builder
			closed := false
			for len(value) > 0 {
				if value[0] == '"' {
					value = value[1:]
					if len(value) > 0 && value[0] == '"' {
						part.WriteByte('"')
						value = value[1:]
						continue
					}
					closed = true
					break
				}
				part.WriteByte(value[0])
				value = value[1:]
			}
			if !closed {
				break
			}
			parts = append(parts, part.String())
			if value == "" {
				if len(parts) == 2 {
					return parts[0], parts[1], nil
				}
				break
			}
			if value[0] != '.' {
				break
			}
			value = value[1:]
		}
		return "", "", errRelation
	}
	if value == "" {
		return "", "", errRelation
	}
	return "public", value, nil
}
