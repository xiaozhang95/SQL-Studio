package httpapi

import (
	"bufio"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"net/http"

	"github.com/gin-gonic/gin"

	"sql-studio-backend/internal/modules/query"
)

const maxRequestBytes = 1024 * 1024

func respond(c *gin.Context, status int, value any) {
	c.Header("Cache-Control", "no-store")
	c.JSON(status, value)
}
func fail(c *gin.Context, err error) {
	status := http.StatusBadRequest
	switch {
	case errors.Is(err, fs.ErrNotExist):
		status = http.StatusNotFound
	case errors.Is(err, query.ErrBusy):
		status = http.StatusTooManyRequests
	}
	respond(c, status, gin.H{"error": err.Error()})
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
		return errors.New("请求必须为单个 JSON 对象")
	}
	return nil
}
