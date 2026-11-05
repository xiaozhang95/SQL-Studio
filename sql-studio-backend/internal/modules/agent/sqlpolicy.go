package agent

import (
	"errors"
	"strings"
)

type sqlToken struct {
	text       string
	identifier bool
	quote      byte
}

func (t sqlToken) word() string { return strings.ToUpper(t.text) }

var errAgentSQL = errors.New("Agent仅支持单条安全SQL；禁止切换会话、跨库访问、文件、锁、等待及未审核函数。请使用当前目标和普通表达式")

// SQL tokens retain identifiers separately from literals. Reject ambiguous escapes,
// executable comments and dollar-quoted programs rather than guessing their dialect.
func agentSQLTokens(sql string) ([]sqlToken, error) {
	if len(strings.TrimSpace(sql)) == 0 || len(sql) > 16000 {
		return nil, errAgentSQL
	}
	var out []sqlToken
	depth := 0
	for i := 0; i < len(sql); {
		c := sql[i]
		if c <= ' ' {
			i++
			continue
		}
		if c == ';' {
			if strings.TrimSpace(sql[i+1:]) != "" {
				return nil, errAgentSQL
			}
			break
		}
		if c == '$' || c == '#' || c == '@' || c == '\\' || (i+1 < len(sql) && (sql[i:i+2] == "--" || sql[i:i+2] == "/*" || sql[i:i+2] == ":=")) {
			return nil, errAgentSQL
		}
		if c == '\'' || c == '"' || c == '`' {
			quote := c
			i++
			var value strings.Builder
			closed := false
			for i < len(sql) {
				if sql[i] == '\\' {
					return nil, errAgentSQL
				}
				if sql[i] == quote {
					i++
					if i < len(sql) && sql[i] == quote {
						value.WriteByte(quote)
						i++
						continue
					}
					closed = true
					break
				}
				value.WriteByte(sql[i])
				i++
			}
			if !closed {
				return nil, errAgentSQL
			}
			out = append(out, sqlToken{text: value.String(), identifier: quote != '\'', quote: quote})
			continue
		}
		if c >= '0' && c <= '9' {
			start := i
			for i < len(sql) && (sql[i] >= '0' && sql[i] <= '9' || sql[i] == '.') {
				i++
			}
			out = append(out, sqlToken{text: sql[start:i]})
			continue
		}
		if identifierStart(c) {
			start := i
			for i < len(sql) && (identifierStart(sql[i]) || sql[i] >= '0' && sql[i] <= '9') {
				i++
			}
			out = append(out, sqlToken{text: sql[start:i], identifier: true})
			continue
		}
		if c == '(' {
			depth++
		} else if c == ')' {
			depth--
			if depth < 0 {
				return nil, errAgentSQL
			}
		}
		out = append(out, sqlToken{text: string(c)})
		i++
	}
	if depth != 0 || len(out) == 0 {
		return nil, errAgentSQL
	}
	return out, nil
}

func identifierStart(c byte) bool {
	return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c == '_' || c >= 128
}

// Ordinary expression functions are explicit; unknown stored/UDF functions can
// delete data even when embedded in an otherwise non-delete statement.
var safeAgentCalls = strings.Fields(`COUNT SUM AVG MIN MAX ABS ROUND CEIL CEILING FLOOR MOD POWER SQRT
COALESCE NULLIF IFNULL IF GREATEST LEAST LOWER UPPER LENGTH CHAR_LENGTH CHARACTER_LENGTH OCTET_LENGTH
CONCAT CONCAT_WS SUBSTRING SUBSTR TRIM LTRIM RTRIM LEFT RIGHT REVERSE REPEAT
NOW CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP CURDATE CURTIME DATE DATE_FORMAT DATE_ADD DATE_SUB DATEDIFF TIMESTAMPDIFF
EXTRACT TO_CHAR TO_DATE TO_TIMESTAMP DATE_TRUNC JSON_EXTRACT JSON_UNQUOTE JSON_OBJECT JSON_ARRAY
JSON_BUILD_OBJECT JSONB_BUILD_OBJECT JSON_AGG JSONB_AGG ARRAY_AGG STRING_AGG GROUP_CONCAT
ROW_NUMBER RANK DENSE_RANK CAST CONVERT UUID VERSION DATABASE SCHEMA CURRENT_SCHEMA CURRENT_DATABASE
RANDOM RAND GENERATE_SERIES VALUES IN EXISTS AS OVER FILTER PARTITION CHECK KEY UNIQUE PRIMARY FOREIGN FROM JOIN CONFLICT
VARCHAR CHAR CHARACTER DECIMAL NUMERIC FLOAT DOUBLE BIT INT INTEGER BIGINT SMALLINT TINYINT MEDIUMINT
BINARY VARBINARY TIMESTAMP TIMESTAMPTZ TIME BOOLEAN BOOL TEXT JSON JSONB BYTEA ENUM SET`)

type sqlRelations struct {
	columnLists map[int]bool
	aliases     map[string]bool
	objects     []string
}

func agentRelations(tokens []sqlToken, database string, mysql bool) (sqlRelations, error) {
	relations := sqlRelations{columnLists: map[int]bool{}, aliases: map[string]bool{database: true}}
	from := map[int]bool{}
	depth := 0
	cte := tokens[0].word() == "WITH"
	for i, token := range tokens {
		word := ""
		if token.identifier {
			word = token.word()
		}
		if depth == 0 && (word == "SELECT" || word == "UPDATE" || word == "INSERT" || word == "DELETE") {
			cte = false
		}
		if cte && depth == 0 && token.identifier && i > 0 && i+1 < len(tokens) && tokens[i+1].text == "(" && (tokens[i-1].word() == "WITH" || tokens[i-1].word() == "RECURSIVE" || tokens[i-1].text == ",") {
			relations.columnLists[i] = true // CTE column declarations are not function calls.
		}
		if token.text == "(" {
			depth++
			continue
		}
		if token.text == ")" {
			delete(from, depth)
			depth--
			if i+1 < len(tokens) && tokens[i+1].identifier {
				relations.aliases[tokens[i+1].text] = true
			}
			continue
		}
		switch word {
		case "WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "RETURNING", "SET", "VALUES", "UNION", "WINDOW":
			from[depth] = false
		case "FROM", "JOIN", "UPDATE":
			from[depth] = true
		}
		if word == "AS" && i+1 < len(tokens) && tokens[i+1].identifier {
			relations.aliases[tokens[i+1].text] = true
		}
		relation := word == "FROM" || word == "JOIN" || word == "UPDATE" || word == "INTO" || word == "TABLE" || word == "REFERENCES" || token.text == "," && from[depth]
		object := (tokens[0].word() == "CREATE" || tokens[0].word() == "ALTER" || tokens[0].word() == "COMMENT") && (word == "VIEW" || word == "INDEX" || word == "TYPE" || word == "DOMAIN" || word == "SEQUENCE" || word == "SCHEMA" || word == "DATABASE")
		relation = relation || object
		if word == "ON" && tokens[0].word() == "CREATE" {
			relation = true // CREATE INDEX ... ON table (...)
		}
		if !relation {
			continue
		}
		start := i + 1
		for start < len(tokens) && (tokens[start].word() == "IF" || tokens[start].word() == "NOT" || tokens[start].word() == "EXISTS" || tokens[start].word() == "ONLY") {
			start++
		}
		if start >= len(tokens) || !tokens[start].identifier {
			continue
		}
		end := start
		for end+2 < len(tokens) && tokens[end+1].text == "." && tokens[end+2].identifier {
			end += 2
		}
		if mysql && end > start && tokens[start].text != database {
			return sqlRelations{}, errAgentSQL
		}
		if word == "INTO" || word == "TABLE" || word == "REFERENCES" || object || word == "ON" && tokens[0].word() == "CREATE" {
			relations.columnLists[end] = true // Target column lists, never FROM/JOIN table functions.
		}
		var name strings.Builder
		for _, part := range tokens[start : end+1] {
			if part.quote != 0 {
				q := string(part.quote)
				name.WriteString(q + strings.ReplaceAll(part.text, q, q+q) + q)
			} else {
				name.WriteString(part.text)
			}
		}
		relations.objects = append(relations.objects, name.String())
		relations.aliases[tokens[end].text] = true
		if end+1 < len(tokens) && tokens[end+1].identifier {
			alias := end + 1
			if tokens[alias].word() == "AS" {
				alias++
			}
			if alias < len(tokens) && tokens[alias].identifier {
				relations.aliases[tokens[alias].text] = true
			}
		}
	}
	return relations, nil
}

func validateAgentCalls(tokens []sqlToken, relations map[int]bool) error {
	for i, token := range tokens {
		if !token.identifier || i+1 >= len(tokens) || tokens[i+1].text != "(" || relations[i] {
			continue
		}
		if i >= 2 && tokens[i-1].text == "." && !strings.EqualFold(tokens[i-2].text, "pg_catalog") {
			return errAgentSQL
		}
		found := false
		for _, name := range safeAgentCalls {
			if token.word() == name {
				found = true
				break
			}
		}
		if !found {
			return errAgentSQL
		}
	}
	return nil
}

// ValidateReadSQL applies Agent policy before a query reaches the general SQL
// window executor. A database read-only transaction alone cannot stop locks/files.
func ValidateReadSQL(sql, engine, database string) error {
	tokens, err := agentSQLTokens(sql)
	if err != nil {
		return err
	}
	switch tokens[0].word() {
	case "SELECT", "WITH", "SHOW", "DESC", "DESCRIBE", "EXPLAIN":
	default:
		return errAgentSQL
	}
	for _, token := range tokens {
		if !token.identifier {
			continue
		}
		switch token.word() {
		case "INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "REPLACE", "CREATE", "ALTER", "INTO", "SET", "CALL", "DO", "EXECUTE", "PREPARE", "LOCK", "OUTFILE", "DUMPFILE", "FOR", "SHARE":
			return errAgentSQL
		}
	}
	return validateAgentScope(tokens, engine, database)
}

// ValidateSQLScope also protects writes before their confirmation is presented.
func ValidateSQLScope(sql, engine, database string) error {
	tokens, err := agentSQLTokens(sql)
	if err != nil {
		return err
	}
	return validateAgentScope(tokens, engine, database)
}

func validateAgentScope(tokens []sqlToken, engine, database string) error {
	mysql := engine == "" || engine == "mysql" || engine == "mariadb"
	relations, err := agentRelations(tokens, database, mysql)
	if err != nil {
		return err
	}
	if err := validateAgentCalls(tokens, relations.columnLists); err != nil {
		return err
	}
	if mysql {
		for i, token := range tokens {
			if token.identifier && i+1 < len(tokens) && tokens[i+1].text == "." && (i == 0 || tokens[i-1].text != ".") && !relations.aliases[token.text] {
				return errAgentSQL
			}
		}
	}
	return nil
}

func approvalObjects(sql string) []string {
	tokens, err := agentSQLTokens(sql)
	if err != nil {
		return nil
	}
	relations, err := agentRelations(tokens, "", false)
	if err != nil {
		return nil
	}
	seen := map[string]bool{}
	objects := []string{}
	for _, name := range relations.objects {
		if !seen[name] {
			objects = append(objects, name)
			seen[name] = true
		}
	}
	return objects
}
