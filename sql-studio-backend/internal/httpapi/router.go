// Package httpapi 负责请求解码、调用业务服务和响应编码，不直接操作数据库或配置文件。
package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	agent "sql-studio-backend/internal/modules/agent"
	agentlayout "sql-studio-backend/internal/modules/agentlayout"
	"sql-studio-backend/internal/modules/ai"
	"sql-studio-backend/internal/modules/connections"
	"sql-studio-backend/internal/modules/metadata"
	"sql-studio-backend/internal/modules/query"
	"sql-studio-backend/internal/modules/settings"
	"sql-studio-backend/internal/modules/workspace"
)

// Services 是单体 HTTP 入口消费的业务模块，由 app 统一装配并复用。
type Services struct {
	Agent       *agent.Service
	AgentLayout *agentlayout.Service
	Workspace   *workspace.Service
	AI          *ai.Service
	Connections *connections.Service
	Metadata    *metadata.Service
	Queries     *query.Service
	Settings    *settings.Service
}

type handler struct {
	workspace   *workspace.Service
	ai          *ai.Service
	connections *connections.Service
	metadata    *metadata.Service
	queries     *query.Service
	settings    *settings.Service
}

func New(services Services) *gin.Engine {
	h := &handler{workspace: services.Workspace, ai: services.AI, connections: services.Connections, metadata: services.Metadata, queries: services.Queries, settings: services.Settings}
	router := gin.New()
	_ = router.SetTrustedProxies(nil)
	router.Use(gin.Recovery(), responseLanguage, localOnly)
	api := router.Group("/api")
	registerAgent(api, services)
	api.GET("/openapi.json", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.Data(http.StatusOK, "application/json; charset=utf-8", openAPISpec)
	})
	api.POST("/ai/assist", h.assist)
	api.POST("/ai/models", h.aiModels)
	api.DELETE("/ai/config", h.removeAI)
	api.GET("/health", func(c *gin.Context) {
		respond(c, http.StatusOK, gin.H{"status": "ok", "service": "SQL Studio", "framework": "gin"})
	})
	api.GET("/state/:section", h.readState)
	api.PUT("/state/:section", h.writeState)
	api.GET("/workspace", h.readWorkspace)
	api.PUT("/workspace", h.commitWorkspace)
	api.GET("/workspace/parts/:id", h.readWorkspacePart)
	api.GET("/connections", h.listConnections)
	api.GET("/connection-groups", h.listGroups)
	api.POST("/connection-groups", h.createGroup)
	api.POST("/connection-groups/rename", h.renameGroup)
	api.DELETE("/connection-groups", h.deleteGroup)
	api.PATCH("/connections/:id/group", h.moveGroup)
	api.POST("/connections", h.saveConnection)
	api.DELETE("/connections/:id", h.deleteConnection)
	api.POST("/connections/:id/session", h.setSession)
	api.POST("/connections/test", h.testConnection)
	api.GET("/connections/:id/databases", h.databases)
	api.GET("/connections/:id/schemas", h.schemas)
	api.GET("/connections/:id/tables", h.tables)
	api.GET("/connections/:id/columns", h.columns)
	api.GET("/connections/:id/indexes", h.indexes)
	api.GET("/connections/:id/ddl", h.ddl)
	api.GET("/connections/:id/export-data", h.exportData)
	api.POST("/connections/:id/query", h.query)
	return router
}
