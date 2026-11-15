package httpapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"sql-studio-backend/internal/localization"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/redistools"
)

func registerRedis(api *gin.RouterGroup, service *redistools.Service) {
	group := api.Group("/connections/:id/redis", func(c *gin.Context) {
		if service == nil {
			respond(c, http.StatusServiceUnavailable, gin.H{"error": "Redis 查询工具不可用"})
			c.Abort()
		}
	})
	group.GET("/keys", func(c *gin.Context) {
		page, err := service.Keys(c.Request.Context(), c.Param("id"), c.Query("database"), c.Query("cursor"), c.Query("pattern"))
		redisResponse(c, page, err)
	})
	for _, route := range []string{"/key", "/key/ttl"} {
		group.POST(route, func(c *gin.Context) {
			var input struct {
				Database string  `json:"database"`
				Ref      *string `json:"ref"`
			}
			if err := decode(c, &input); err != nil {
				fail(c, err)
				return
			}
			if input.Ref == nil {
				respond(c, http.StatusBadRequest, gin.H{"error": "Redis 键引用无效"})
				return
			}
			if route == "/key/ttl" {
				ttl, err := service.KeyTTL(c.Request.Context(), c.Param("id"), input.Database, *input.Ref)
				redisResponse(c, ttl, err)
				return
			}
			detail, err := service.Key(c.Request.Context(), c.Param("id"), input.Database, *input.Ref)
			redisResponse(c, detail, err)
		})
	}
	group.POST("/command", func(c *gin.Context) {
		var input struct {
			Database string `json:"database"`
			Command  string `json:"command"`
		}
		if err := decode(c, &input); err != nil {
			fail(c, err)
			return
		}
		result, err := service.Run(c.Request.Context(), c.Param("id"), input.Database, input.Command)
		redisResponse(c, result, err)
	})
	group.POST("/key/change", func(c *gin.Context) {
		var input struct {
			Database string  `json:"database"`
			Ref      *string `json:"ref"`
			model.RedisKeyChange
		}
		if err := decodeLimit(c, &input, 768*1024); err != nil {
			fail(c, err)
			return
		}
		result, err := service.ChangeKey(c.Request.Context(), c.Param("id"), input.Database, input.Ref, input.RedisKeyChange)
		redisResponse(c, result, err)
	})
	group.GET("/channels", func(c *gin.Context) {
		result, err := service.Channels(c.Request.Context(), c.Param("id"), c.Query("pattern"))
		redisResponse(c, result, err)
	})
	group.POST("/subscribe", func(c *gin.Context) {
		var input struct {
			Channel string `json:"channel"`
			Pattern bool   `json:"pattern"`
		}
		if err := decodeLimit(c, &input, 8*1024); err != nil {
			fail(c, err)
			return
		}
		control := http.NewResponseController(c.Writer)
		emit := func(event model.RedisEvent) error {
			if !c.Writer.Written() {
				c.Header("Content-Type", "application/x-ndjson; charset=utf-8")
				c.Header("Cache-Control", "no-store")
				c.Header("X-Accel-Buffering", "no")
			}
			_ = control.SetWriteDeadline(time.Now().Add(20 * time.Second))
			if err := json.NewEncoder(c.Writer).Encode(event); err != nil {
				return err
			}
			return control.Flush()
		}
		err := service.Subscribe(c.Request.Context(), c.Param("id"), input.Channel, input.Pattern, emit)
		if err == nil || c.Request.Context().Err() != nil {
			return
		}
		if !c.Writer.Written() {
			fail(c, err)
		} else {
			_ = emit(model.RedisEvent{Type: "error", Payload: localization.Text(languageFor(c), err.Error())})
		}
	})
}

func redisResponse(c *gin.Context, value any, err error) {
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, http.StatusOK, value)
}
