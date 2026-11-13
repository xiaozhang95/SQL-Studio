package httpapi

import (
	"errors"
	"github.com/gin-gonic/gin"
	"net/http"
	model "sql-studio-backend/internal/model/agent"
	agent "sql-studio-backend/internal/modules/agent"
	"strconv"
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
	if view, ok := v.(model.ConversationView); ok {
		view.Events = append([]model.Event{}, view.Events...)
		for index, event := range view.Events {
			view.Events[index] = localizedEvent(languageFor(c), event)
		}
		v = view
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
	a.GET("/sessions/:id", func(c *gin.Context) {
		offset, err := strconv.Atoi(c.DefaultQuery("offset", "0"))
		if err != nil {
			fail(c, errors.New("会话分页位置无效"))
			return
		}
		revision, err := strconv.ParseUint(c.DefaultQuery("revision", "0"), 10, 64)
		if err != nil {
			fail(c, errors.New("会话分页版本无效"))
			return
		}
		var versions []uint64
		if raw := c.Query("eventVersion"); raw != "" {
			version, err := strconv.ParseUint(raw, 10, 64)
			if err != nil {
				fail(c, errors.New("会话分页版本无效"))
				return
			}
			versions = []uint64{version}
		}
		v, e := s.Agent.ViewPage(c.Request.Context(), c.Param("id"), offset, revision, versions...)
		agentResponse(c, v, e)
	})
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
	a.DELETE("/sessions/:id", func(c *gin.Context) { agentResponse(c, struct{}{}, s.Agent.Delete(c.Request.Context(), c.Param("id"))) })
	a.POST("/write-confirmation", confirmAgentStep(s.Agent.ConfirmWrite))
	a.POST("/continue-confirmation", confirmAgentStep(s.Agent.ConfirmContinue))
	a.POST("/chat", (&agentHandler{s.Agent}).stream)
	a.GET("/workspace", func(c *gin.Context) { v, e := s.AgentLayout.Read(c.Request.Context()); agentResponse(c, v, e) })
	a.PUT("/workspace", func(c *gin.Context) {
		var input struct {
			Revision *uint64       `json:"revision"`
			State    *model.Layout `json:"state"`
		}
		if e := decodeLimit(c, &input, model.MessageJSONMaxBytes); e != nil {
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

func confirmAgentStep(confirm func(string, bool) error) gin.HandlerFunc {
	return func(c *gin.Context) {
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
		agentResponse(c, struct{}{}, confirm(input.ID, *input.Allow))
	}
}
