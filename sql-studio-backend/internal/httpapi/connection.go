package httpapi

import (
	"encoding/json"
	"errors"
	"github.com/gin-gonic/gin"

	"sql-studio-backend/internal/model"
)

func (h *handler) listConnections(c *gin.Context) {
	respond(c, 200, h.connections.ListConnections())
}

func (h *handler) setSession(c *gin.Context) {
	var input struct {
		Database json.RawMessage `json:"database"`
		Open     *bool           `json:"open"`
	}
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	if input.Open == nil {
		fail(c, errors.New("必须指定 open"))
		return
	}
	var database *string
	if len(input.Database) > 0 {
		var name string
		if err := json.Unmarshal(input.Database, &name); err != nil {
			fail(c, err)
			return
		}
		database = &name
	}
	if err := h.connections.SetSession(c.Request.Context(), c.Param("id"), database, *input.Open); err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, gin.H{"open": *input.Open})
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
