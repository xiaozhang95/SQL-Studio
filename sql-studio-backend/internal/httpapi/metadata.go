package httpapi

import "github.com/gin-gonic/gin"

func (h *handler) databases(c *gin.Context) {
	data, err := h.metadata.Databases(c.Request.Context(), c.Param("id"))
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, data)
}
func (h *handler) tables(c *gin.Context) {
	data, err := h.metadata.Tables(c.Request.Context(), c.Param("id"), c.Query("database"))
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, data)
}
func (h *handler) columns(c *gin.Context) {
	data, err := h.metadata.Columns(c.Request.Context(), c.Param("id"), c.Query("database"), c.Query("table"))
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, data)
}
func (h *handler) ddl(c *gin.Context) {
	data, err := h.metadata.DDL(c.Request.Context(), c.Param("id"), c.Query("database"), c.Query("table"))
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, gin.H{"ddl": data})
}

func (h *handler) indexes(c *gin.Context) {
	data, err := h.metadata.Indexes(c.Request.Context(), c.Param("id"), c.Query("database"), c.Query("table"))
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, data)
}

func (h *handler) foreignKeys(c *gin.Context) {
	data, err := h.metadata.ForeignKeys(c.Request.Context(), c.Param("id"), c.Query("database"), c.Query("table"))
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, data)
}

func (h *handler) schemas(c *gin.Context) {
	data, err := h.metadata.Schemas(c.Request.Context(), c.Param("id"), c.Query("database"))
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, data)
}

func (h *handler) monitor(c *gin.Context) {
	snapshot, err := h.metadata.Monitor(c.Request.Context(), c.Param("id"), c.Query("database"))
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, snapshot)
}
