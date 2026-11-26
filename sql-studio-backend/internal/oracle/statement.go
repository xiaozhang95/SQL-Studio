package oracle

import (
	"errors"
	"strings"
	"unicode/utf8"
)

var errSingleStatement = errors.New("Oracle 请求每次只能执行一条 SQL 或一个 PL/SQL 块")
var errReadOnly = errors.New("Oracle 默认只读查询仅接受 SELECT 和查询型 WITH")
var errTransactionNeedsBatch = errors.New("请在同一个 SQL 批次中执行 Oracle 事务及其语句")

type sqlToken struct {
	word       string
	start, end int
}

// SQL*Plus commands are handled by the editor; the server receives a SQL or PL/SQL unit.
func statementTokens(input string) ([]sqlToken, error) {
	var tokens []sqlToken
	for i := 0; i < len(input); {
		start := i
		switch {
		case input[i] <= ' ':
			i++
			continue
		case strings.HasPrefix(input[i:], "--"):
			offset := strings.IndexAny(input[i+2:], "\n\r")
			if offset < 0 {
				return tokens, nil
			}
			i += 2 + offset
			continue
		case strings.HasPrefix(input[i:], "/*"):
			offset := strings.Index(input[i+2:], "*/")
			if offset < 0 {
				return nil, errSingleStatement
			}
			i += 4 + offset
			continue
		case input[i] == '\'' || input[i] == '"':
			offset := quotedEnd(input, i)
			if offset < 0 {
				return nil, errSingleStatement
			}
			i = offset
			tokens = append(tokens, sqlToken{start: start, end: i})
			continue
		case wordByte(input[i]):
			for i < len(input) && wordByte(input[i]) {
				i++
			}
			word := strings.ToUpper(input[start:i])
			if (word == "Q" || word == "NQ") && i < len(input) && input[i] == '\'' {
				i = alternativeQuoteEnd(input, i+1)
				if i < 0 {
					return nil, errSingleStatement
				}
				word = ""
			}
			tokens = append(tokens, sqlToken{word: word, start: start, end: i})
		default:
			i++
			tokens = append(tokens, sqlToken{word: input[start:i], start: start, end: i})
		}
	}
	return tokens, nil
}

func wordByte(char byte) bool {
	return char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char >= '0' && char <= '9' ||
		char == '_' || char == '$' || char == '#' || char >= utf8.RuneSelf
}

func quotedEnd(input string, start int) int {
	quote := input[start]
	for i := start + 1; i < len(input); i++ {
		if input[i] == quote {
			if i+1 >= len(input) || input[i+1] != quote {
				return i + 1
			}
			i++
		}
	}
	return -1
}

func alternativeQuoteEnd(input string, start int) int {
	if start >= len(input) {
		return -1
	}
	delimiter, width := utf8.DecodeRuneInString(input[start:])
	switch delimiter {
	case '[':
		delimiter = ']'
	case '{':
		delimiter = '}'
	case '(':
		delimiter = ')'
	case '<':
		delimiter = '>'
	}
	end := string(delimiter) + "'"
	if offset := strings.Index(input[start+width:], end); offset >= 0 {
		return start + width + offset + len(end)
	}
	return -1
}

func procedural(tokens []sqlToken) bool {
	switch tokens[0].word {
	case "BEGIN", "DECLARE":
		return true
	case "CREATE":
		i := 1
		if len(tokens) > i+1 && tokens[i].word == "OR" && tokens[i+1].word == "REPLACE" {
			i += 2
		}
		if len(tokens) > i && (tokens[i].word == "EDITIONABLE" || tokens[i].word == "NONEDITIONABLE") {
			i++
		}
		if len(tokens) > i {
			switch tokens[i].word {
			case "FUNCTION", "PROCEDURE", "PACKAGE", "TRIGGER", "TYPE":
				return true
			}
		}
	}
	return false
}

func normalizedStatement(input string) (string, []sqlToken, error) {
	tokens, err := statementTokens(input)
	if err != nil || len(tokens) == 0 {
		return "", nil, errSingleStatement
	}
	last := tokens[len(tokens)-1]
	if last.word == "/" {
		lineStart := strings.LastIndexAny(input[:last.start], "\r\n") + 1
		if strings.TrimSpace(input[lineStart:last.start]) == "" {
			tokens = tokens[:len(tokens)-1]
			if len(tokens) == 0 {
				return "", nil, errSingleStatement
			}
			last = tokens[len(tokens)-1]
		}
	}
	if !procedural(tokens) {
		if last.word == ";" {
			tokens = tokens[:len(tokens)-1]
			if len(tokens) == 0 {
				return "", nil, errSingleStatement
			}
			last = tokens[len(tokens)-1]
		}
		for _, token := range tokens {
			if token.word == ";" {
				return "", nil, errSingleStatement
			}
		}
	}
	return strings.TrimSpace(input[:last.end]), tokens, nil
}

func selectStatement(tokens []sqlToken) bool {
	if tokens[0].word == "SELECT" {
		return true
	}
	if tokens[0].word != "WITH" {
		return false
	}
	depth := 0
	for _, token := range tokens[1:] {
		switch token.word {
		case "(":
			depth++
		case ")":
			depth--
		case "FUNCTION", "PROCEDURE":
			return false
		case "SELECT":
			if depth == 0 {
				return true
			}
		}
	}
	return false
}

func readOnlySelect(tokens []sqlToken) bool {
	if !selectStatement(tokens) {
		return false
	}
	for i, token := range tokens {
		if token.word == "NEXTVAL" || (token.word == "FOR" && i+1 < len(tokens) && tokens[i+1].word == "UPDATE") {
			return false
		}
	}
	return true
}

func transactionControl(tokens []sqlToken) string {
	switch tokens[0].word {
	case "COMMIT", "ROLLBACK", "SAVEPOINT":
		return tokens[0].word
	case "SET":
		if len(tokens) > 1 && tokens[1].word == "TRANSACTION" {
			return "SET TRANSACTION"
		}
	}
	return ""
}
