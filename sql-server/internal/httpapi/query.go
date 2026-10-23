package httpapi

import (
	"github.com/gin-gonic/gin"

	"sqldesk/internal/model"
)

func (h *handler) query(c *gin.Context) {
	var input model.QueryRequest
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	result, err := h.service.Query(c.Request.Context(), c.Param("id"), input)
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, result)
}
