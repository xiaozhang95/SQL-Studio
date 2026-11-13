package localization

import (
	"regexp"
	"sort"
	"strconv"
	"strings"
)

type Language string

const (
	Chinese Language = "zh-CN"
	English Language = "en-US"
)

// ParseAcceptLanguage selects the highest-weight supported language, defaulting to Chinese.
func ParseAcceptLanguage(header string) Language {
	selected, best := Chinese, 0.0
	for _, entry := range strings.Split(header, ",") {
		parts := strings.Split(entry, ";")
		tag := strings.ToLower(strings.TrimSpace(parts[0]))
		var candidate Language
		switch {
		case tag == "en" || strings.HasPrefix(tag, "en-"):
			candidate = English
		case tag == "zh" || strings.HasPrefix(tag, "zh-") || tag == "*":
			candidate = Chinese
		default:
			continue
		}
		quality := 1.0
		for _, parameter := range parts[1:] {
			key, value, ok := strings.Cut(strings.TrimSpace(parameter), "=")
			if ok && strings.EqualFold(key, "q") {
				parsed, err := strconv.ParseFloat(value, 64)
				if err != nil || parsed < 0 || parsed > 1 || parsed != parsed {
					quality = 0
					break
				}
				quality = parsed
			}
		}
		if quality > best {
			selected, best = candidate, quality
		}
	}
	return selected
}

type messagePattern struct {
	match    *regexp.Regexp
	english  string
	wrapped  []bool
	specific int
	source   string
}

var formatToken = regexp.MustCompile(`%(?:\.[0-9]+)?[sdqvwf]`)
var placeholder = regexp.MustCompile(`\{([1-9][0-9]*)\}`)
var patterns = compilePatterns()

func compilePatterns() []messagePattern {
	var result []messagePattern
	for source, english := range messages {
		tokens := formatToken.FindAllStringIndex(source, -1)
		if len(tokens) == 0 {
			continue
		}
		var expression strings.Builder
		expression.WriteString("(?s)^")
		item := messagePattern{english: english, source: source}
		previous := 0
		for _, token := range tokens {
			literal := source[previous:token[0]]
			expression.WriteString(regexp.QuoteMeta(literal))
			switch format := source[token[0]:token[1]]; format {
			case "%q":
				expression.WriteString(`("(?:\\.|[^"\\])*")`)
			case "%d":
				expression.WriteString(`(-?[0-9]+)`)
			default:
				expression.WriteString("(.*?)")
			}
			item.specific += len(literal)
			item.wrapped = append(item.wrapped, source[token[0]:token[1]] == "%w")
			previous = token[1]
		}
		for _, index := range nestedCaptures[source] {
			if index > 0 && index <= len(item.wrapped) {
				item.wrapped[index-1] = true
			}
		}
		expression.WriteString(regexp.QuoteMeta(source[previous:]))
		expression.WriteString("$")
		item.specific += len(source[previous:])
		item.match = regexp.MustCompile(expression.String())
		result = append(result, item)
	}
	// Specific templates precede general error wrappers; ordering is deterministic.
	sort.Slice(result, func(i, j int) bool {
		if result[i].specific == result[j].specific {
			return result[i].source < result[j].source
		}
		return result[i].specific > result[j].specific
	})
	return result
}

// Text translates only complete, known application messages. Dynamic values remain verbatim.
func Text(language Language, message string) string {
	if language != English {
		return message
	}
	return englishText(message, 0)
}

func englishText(message string, depth int) string {
	if depth > 8 {
		return message
	}
	if english, found := messages[message]; found {
		return english
	}
	for _, pattern := range patterns {
		captures := pattern.match.FindStringSubmatch(message)
		if captures == nil {
			continue
		}
		return placeholder.ReplaceAllStringFunc(pattern.english, func(value string) string {
			index, _ := strconv.Atoi(value[1 : len(value)-1])
			if index <= 0 || index >= len(captures) {
				return value
			}
			if pattern.wrapped[index-1] {
				return englishText(captures[index], depth+1)
			}
			return captures[index]
		})
	}
	return message
}
