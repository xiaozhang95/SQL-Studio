package httpapi

import (
	"encoding/json"
	"errors"
	"github.com/gin-gonic/gin"
	"io"
	"net/http"
	"sql-studio/internal/model"
	"sql-studio/internal/modules/settings"
)

func (h *handler) readState(c *gin.Context) {
	if h.settings == nil {
		respond(c, 503, gin.H{"error": "配置服务未启用"})
		return
	}
	doc, err := h.settings.Read(c.Request.Context(), c.Param("section"))
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, doc)
}
func (h *handler) writeState(c *gin.Context) {
	if h.settings == nil {
		respond(c, 503, gin.H{"error": "配置服务未启用"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, settings.MaxBytes+1024)
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	var input model.StateWrite
	if err := decoder.Decode(&input); err != nil {
		fail(c, err)
		return
	}
	var extra json.RawMessage
	if decoder.Decode(&extra) != io.EOF {
		fail(c, errors.New("请求必须为单个 JSON 对象"))
		return
	}
	doc, err := h.settings.Write(c.Request.Context(), c.Param("section"), input)
	if err != nil {
		if errors.Is(err, settings.ErrConflict) {
			respond(c, 409, gin.H{"error": err.Error()})
			return
		}
		fail(c, err)
		return
	}
	respond(c, 200, doc)
}

func (h *handler) removeAI(c *gin.Context) {
	if h.settings == nil {
		respond(c, 503, gin.H{"error": "配置服务未启用"})
		return
	}
	var input struct {
		Revision uint64 `json:"revision"`
	}
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	doc, err := h.settings.RemoveAI(c.Request.Context(), input.Revision)
	if errors.Is(err, settings.ErrConflict) {
		respond(c, 409, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, doc)
}
