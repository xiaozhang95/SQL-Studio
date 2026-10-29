package httpapi

import "github.com/gin-gonic/gin"

func (h *handler) listGroups(c *gin.Context) { respond(c, 200, h.connections.ListGroups()) }
func (h *handler) createGroup(c *gin.Context) {
	var input struct {
		Name string `json:"name"`
	}
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	groups, err := h.connections.CreateGroup(input.Name)
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, groups)
}
func (h *handler) renameGroup(c *gin.Context) {
	var input struct {
		Name    string `json:"name"`
		NewName string `json:"newName"`
	}
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	state, err := h.connections.RenameGroup(input.Name, input.NewName)
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, state)
}
func (h *handler) moveGroup(c *gin.Context) {
	var input struct {
		Group string `json:"group"`
	}
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	connection, err := h.connections.MoveGroup(c.Param("id"), input.Group)
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, connection)
}
