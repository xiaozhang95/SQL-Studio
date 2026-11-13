package httpapi

import (
	"encoding/json"

	"github.com/gin-gonic/gin"
	"sql-studio-backend/internal/localization"
	model "sql-studio-backend/internal/model/agent"
)

const responseLanguageKey = "sql-studio.response-language"

func languageFor(c *gin.Context) localization.Language {
	if value, exists := c.Get(responseLanguageKey); exists {
		if language, ok := value.(localization.Language); ok {
			return language
		}
	}
	return localization.ParseAcceptLanguage(c.GetHeader("Accept-Language"))
}

func responseLanguage(c *gin.Context) {
	language := languageFor(c)
	c.Set(responseLanguageKey, language)
	c.Header("Content-Language", string(language))
	c.Writer.Header().Add("Vary", "Accept-Language")
	c.Next()
}

// Localize a copy at the transport boundary; saved events and model content stay intact.
func localizedEvent(language localization.Language, event model.Event) model.Event {
	switch event.Type {
	case "error", "stopped", "status":
		event.Text = localization.Text(language, event.Text)
	case "continue_confirmation":
		event.Result = localizedFields(language, event.Result, "detail")
	case "tool_result":
		event.Result = localizedFields(language, event.Result, "error", "warning", "instruction")
	}
	return event
}

func localizedFields(language localization.Language, value json.RawMessage, fields ...string) json.RawMessage {
	if language != localization.English {
		return value
	}
	var object map[string]json.RawMessage
	if json.Unmarshal(value, &object) != nil || object == nil {
		return value
	}
	changed := false
	for _, field := range fields {
		var text string
		if json.Unmarshal(object[field], &text) != nil {
			continue
		}
		translated := localization.Text(language, text)
		if translated != text {
			object[field], _ = json.Marshal(translated)
			changed = true
		}
	}
	if !changed {
		return value
	}
	encoded, err := json.Marshal(object)
	if err != nil {
		return value
	}
	return encoded
}
