package httpapi

import (
	"errors"
	"github.com/gin-gonic/gin"
	"net/http"
	model "sql-studio-backend/internal/model/agent"
	agent "sql-studio-backend/internal/modules/agent"
)

type agentHandler struct{ chat *agent.Service }

func agentResponse(c *gin.Context, v interface{}, err error) {
	if errors.Is(err, model.ErrConflict) {
		respond(c, 409, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, v)
}
func registerAgent(api *gin.RouterGroup, s Services) {
	a := api.Group("/agent")
	a.Use(func(c *gin.Context) {
		if s.Agent == nil || s.AgentLayout == nil || s.Settings == nil {
			respond(c, http.StatusServiceUnavailable, gin.H{"error": "Agent服务未装配"})
			c.Abort()
			return
		}
		c.Next()
	})
	a.GET("/sessions", func(c *gin.Context) { v, e := s.Agent.List(c.Request.Context()); agentResponse(c, v, e) })
	a.POST("/sessions", func(c *gin.Context) {
		var input struct {
			Ensure bool `json:"ensure"`
		}
		if e := decodeLimit(c, &input, 32*1024); e != nil {
			fail(c, e)
			return
		}
		var v string
		var e error
		if input.Ensure {
			v, e = s.Agent.Ensure(c.Request.Context())
		} else {
			v, e = s.Agent.Create(c.Request.Context())
		}
		agentResponse(c, gin.H{"id": v}, e)
	})
	a.GET("/sessions/:id", func(c *gin.Context) { v, e := s.Agent.View(c.Request.Context(), c.Param("id")); agentResponse(c, v, e) })
	a.PATCH("/sessions/:id", func(c *gin.Context) {
		var input struct {
			Title string `json:"title"`
		}
		if err := decodeLimit(c, &input, 32*1024); err != nil {
			fail(c, err)
			return
		}
		v, err := s.Agent.Rename(c.Request.Context(), c.Param("id"), input.Title)
		agentResponse(c, v, err)
	})
	a.DELETE("/sessions/:id", func(c *gin.Context) { agentResponse(c, struct{}{}, s.Agent.Delete(c.Param("id"))) })
	a.POST("/write-confirmation", func(c *gin.Context) {
		var input struct {
			ID    string `json:"approvalId"`
			Allow *bool  `json:"allow"`
		}
		if err := decodeLimit(c, &input, 4096); err != nil {
			fail(c, err)
			return
		}
		if input.Allow == nil {
			fail(c, errors.New("缺少确认结果"))
			return
		}
		agentResponse(c, struct{}{}, s.Agent.ConfirmWrite(input.ID, *input.Allow))
	})
	a.POST("/chat", (&agentHandler{s.Agent}).stream)
	a.GET("/workspace", func(c *gin.Context) { v, e := s.AgentLayout.Read(c.Request.Context()); agentResponse(c, v, e) })
	a.PUT("/workspace", func(c *gin.Context) {
		var input struct {
			Revision *uint64       `json:"revision"`
			State    *model.Layout `json:"state"`
		}
		if e := decodeLimit(c, &input, 32*1024); e != nil {
			fail(c, e)
			return
		}
		if input.Revision == nil || input.State == nil {
			fail(c, errors.New("必须提供revision和state"))
			return
		}
		v, e := s.AgentLayout.Save(c.Request.Context(), *input.Revision, *input.State)
		agentResponse(c, v, e)
	})
	a.GET("/settings", func(c *gin.Context) { v, e := s.Settings.AgentStatus(c.Request.Context()); agentResponse(c, v, e) })
	a.PUT("/settings", func(c *gin.Context) {
		var input model.AIUpdate
		if e := decodeLimit(c, &input, 32*1024); e != nil {
			fail(c, e)
			return
		}
		v, e := s.Settings.UpdateAgent(c.Request.Context(), input)
		agentResponse(c, v, e)
	})
	a.DELETE("/settings", func(c *gin.Context) { v, e := s.Settings.ClearAgent(c.Request.Context()); agentResponse(c, v, e) })
}
