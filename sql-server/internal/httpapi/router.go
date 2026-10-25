// Package httpapi 负责请求解码、调用业务服务和响应编码，不直接操作数据库或配置文件。
package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"sqldesk/internal/modules/connections"
	"sqldesk/internal/modules/metadata"
	"sqldesk/internal/modules/query"
)

// Services 是单体 HTTP 入口消费的业务模块，由 app 统一装配并复用。
type Services struct {
	Connections *connections.Service
	Metadata    *metadata.Service
	Queries     *query.Service
}

type handler struct {
	connections *connections.Service
	metadata    *metadata.Service
	queries     *query.Service
}

func New(services Services) *gin.Engine {
	h := &handler{connections: services.Connections, metadata: services.Metadata, queries: services.Queries}
	router := gin.New()
	_ = router.SetTrustedProxies(nil)
	router.Use(gin.Recovery(), localOnly)
	api := router.Group("/api")
	api.GET("/health", func(c *gin.Context) {
		respond(c, http.StatusOK, gin.H{"status": "ok", "service": "SQL Studio", "framework": "gin"})
	})
	api.GET("/connections", h.listConnections)
	api.POST("/connections", h.saveConnection)
	api.DELETE("/connections/:id", h.deleteConnection)
	api.POST("/connections/test", h.testConnection)
	api.GET("/connections/:id/databases", h.databases)
	api.GET("/connections/:id/tables", h.tables)
	api.GET("/connections/:id/columns", h.columns)
	api.GET("/connections/:id/ddl", h.ddl)
	api.POST("/connections/:id/query", h.query)
	return router
}
