package httpapi

import (
	"errors"
	"github.com/gin-gonic/gin"
	"sql-studio/internal/model"
	"sql-studio/internal/modules/ai"
)

func (h *handler) assist(c *gin.Context) {
	if h.ai == nil {
		respond(c, 503, gin.H{"error": "AI 服务未启用"})
		return
	}
	var input model.AIRequest
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	result, err := h.ai.Assist(c.Request.Context(), input)
	if errors.Is(err, ai.ErrBusy) {
		respond(c, 429, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, result)
}

func (h *handler) aiModels(c *gin.Context) {
	if h.ai == nil {
		respond(c, 503, gin.H{"error": "AI 服务未启用"})
		return
	}
	var input model.AIModelsRequest
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	result, err := h.ai.Models(c.Request.Context(), input)
	if errors.Is(err, ai.ErrBusy) {
		respond(c, 429, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, result)
}
