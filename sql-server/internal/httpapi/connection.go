package httpapi

import (
	"github.com/gin-gonic/gin"

	"sql-studio/internal/model"
)

func (h *handler) listConnections(c *gin.Context) {
	respond(c, 200, h.connections.ListConnections())
}
func (h *handler) saveConnection(c *gin.Context) {
	var input model.Connection
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	saved, err := h.connections.SaveConnection(input)
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, saved)
}
func (h *handler) deleteConnection(c *gin.Context) {
	if err := h.connections.DeleteConnection(c.Param("id")); err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, gin.H{"ok": true})
}
func (h *handler) testConnection(c *gin.Context) {
	var input model.Connection
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	version, err := h.connections.TestConnection(c.Request.Context(), input)
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, gin.H{"version": version})
}
