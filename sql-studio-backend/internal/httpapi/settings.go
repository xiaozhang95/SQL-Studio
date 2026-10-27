package httpapi

import (
	"encoding/json"
	"errors"
	"github.com/gin-gonic/gin"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/settings"
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
	var input struct {
		Revision *uint64         `json:"revision"`
		Data     json.RawMessage `json:"data"`
	}
	if err := decodeLimit(c, &input, settings.MaxBytes+1024); err != nil {
		fail(c, err)
		return
	}
	if input.Revision == nil {
		fail(c, errors.New("请提供配置修订号 revision"))
		return
	}
	doc, err := h.settings.Write(c.Request.Context(), c.Param("section"), model.StateWrite{Revision: *input.Revision, Data: input.Data})
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
		Revision *uint64 `json:"revision"`
	}
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	if input.Revision == nil {
		fail(c, errors.New("请提供配置修订号 revision"))
		return
	}
	doc, err := h.settings.RemoveAI(c.Request.Context(), *input.Revision)
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
