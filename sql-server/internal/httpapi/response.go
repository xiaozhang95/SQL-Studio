package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"net/http"

	"github.com/gin-gonic/gin"

	"sqldesk/internal/modules/query"
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
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxRequestBytes)
	decoder := json.NewDecoder(c.Request.Body)
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
