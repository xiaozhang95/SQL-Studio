// Package httpapi 负责请求解码、调用业务服务和响应编码，不直接操作数据库或配置文件。
package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"sqldesk/internal/service"
)

type handler struct{ service *service.Service }

func New(svc *service.Service) *gin.Engine {
	h := &handler{service: svc}
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
