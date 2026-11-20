package httpapi

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"

	"github.com/gin-gonic/gin"

	"sql-studio-backend/internal/localization"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/query"
)

const maxRequestBytes = 1024 * 1024

// NotFound keeps the application's fallback API route on the shared response path.
func NotFound(c *gin.Context) {
	respond(c, http.StatusNotFound, gin.H{"error": "接口不存在"})
}

func respond(c *gin.Context, status int, value any) {
	c.Header("Cache-Control", "no-store")
	if status >= http.StatusBadRequest {
		if body, ok := value.(gin.H); ok {
			if message, ok := body["error"].(string); ok {
				localized := make(gin.H, len(body))
				for key, field := range body {
					localized[key] = field
				}
				localized["error"] = localization.Text(languageFor(c), message)
				value = localized
			}
		}
	}
	c.JSON(status, value)
}
func fail(c *gin.Context, err error) {
	status := http.StatusBadRequest
	message := err.Error()
	var limit *http.MaxBytesError
	switch {
	case errors.As(err, &limit):
		status = http.StatusRequestEntityTooLarge
		size := fmt.Sprintf("%d B", limit.Limit)
		if limit.Limit%maxRequestBytes == 0 {
			size = fmt.Sprintf("%d MiB", limit.Limit/maxRequestBytes)
		} else if limit.Limit%1024 == 0 && limit.Limit < maxRequestBytes {
			size = fmt.Sprintf("%d KiB", limit.Limit/1024)
		}
		message = fmt.Sprintf("请求体超过大小上限（%s）。", size)
	case errors.Is(err, fs.ErrNotExist):
		status = http.StatusNotFound
	case errors.Is(err, query.ErrBusy):
		status = http.StatusTooManyRequests
	}
	body := gin.H{"error": message}
	if status == http.StatusBadRequest && model.IsStatementError(err) {
		body["statementError"] = true
	}
	respond(c, status, body)
}
func decode(c *gin.Context, value any) error {
	return decodeLimit(c, value, maxRequestBytes)
}

// JSON null 会被标准库解码成零值结构；先要求对象起始符，防止空请求触发写操作。
// 只预读首个非空白字节，大配置仍由流式 decoder 在原有限额内处理。
func decodeLimit(c *gin.Context, value any, limit int64) error {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
	body := bufio.NewReader(c.Request.Body)
	for {
		first, err := body.ReadByte()
		if err != nil {
			return err
		}
		if first == ' ' || first == '\n' || first == '\r' || first == '\t' {
			continue
		}
		if first != '{' {
			return errors.New("请求必须为单个 JSON 对象")
		}
		if err := body.UnreadByte(); err != nil {
			return err
		}
		break
	}
	decoder := json.NewDecoder(body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return err
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		var limit *http.MaxBytesError
		if errors.As(err, &limit) {
			return err
		}
		return errors.New("请求必须为单个 JSON 对象")
	}
	return nil
}
