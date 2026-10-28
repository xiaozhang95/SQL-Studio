package httpapi

import (
	"encoding/json"
	"errors"
	"github.com/gin-gonic/gin"
	"sql-studio-backend/internal/model"
)

func (h *handler) readWorkspace(c *gin.Context) {
	if h.workspace == nil {
		respond(c, 503, gin.H{"error": "工作区服务未启用"})
		return
	}
	doc, err := h.workspace.Read(c.Request.Context())
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, doc)
}
func (h *handler) readWorkspacePart(c *gin.Context) {
	if h.workspace == nil {
		respond(c, 503, gin.H{"error": "工作区服务未启用"})
		return
	}
	data, err := h.workspace.Part(c.Request.Context(), c.Param("id"))
	if err != nil {
		fail(c, err)
		return
	}
	c.Header("Cache-Control", "no-store")
	c.Data(200, "application/json; charset=utf-8", data)
}
func (h *handler) commitWorkspace(c *gin.Context) {
	if h.workspace == nil {
		respond(c, 503, gin.H{"error": "工作区服务未启用"})
		return
	}
	var input struct {
		Revision *uint64                    `json:"revision"`
		Index    model.WorkspaceIndex       `json:"index"`
		Drafts   map[string]string          `json:"drafts"`
		Results  map[string]json.RawMessage `json:"results"`
	}
	if err := decodeLimit(c, &input, 3*model.WorkspacePartMaxBytes+1024*1024); err != nil {
		fail(c, err)
		return
	}
	if input.Revision == nil {
		fail(c, errors.New("请提供工作区修订号"))
		return
	}
	doc, err := h.workspace.Commit(c.Request.Context(), model.WorkspaceCommit{Revision: *input.Revision, Index: input.Index, Drafts: input.Drafts, Results: input.Results})
	if errors.Is(err, model.ErrStateConflict) {
		respond(c, 409, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, doc)
}
