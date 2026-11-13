package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"sql-studio-backend/internal/localization"
	"sql-studio-backend/internal/model"
)

type exportEvent struct {
	Type   string             `json:"type"`
	Result *model.QueryResult `json:"result,omitempty"`
	Error  string             `json:"error,omitempty"`
}

// exportData only encodes metadata module events; slow clients apply backpressure.
func (h *handler) exportData(c *gin.Context) {
	if c.Query("database") == "" || c.Query("table") == "" {
		respond(c, 400, gin.H{"error": "必须指定数据库和表"})
		return
	}
	id, database, table := c.Param("id"), c.Query("database"), c.Query("table")
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()
	c.Header("Content-Type", "text/event-stream; charset=utf-8")
	c.Header("Cache-Control", "no-store")
	c.Header("X-Accel-Buffering", "no")
	control := http.NewResponseController(c.Writer)
	language := languageFor(c)
	write := func(data string) error {
		// Extend only this streaming response; normal requests retain the server timeout.
		_ = control.SetWriteDeadline(time.Now().Add(30 * time.Second))
		if _, err := fmt.Fprint(c.Writer, data); err != nil {
			return err
		}
		c.Writer.Flush()
		return nil
	}
	if write(": connected\n\n") != nil {
		return
	}
	events := make(chan exportEvent)
	go func() {
		defer close(events)
		send := func(event exportEvent) error {
			select {
			case events <- event:
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		err := h.metadata.StreamTableData(ctx, id, database, table, func(result model.QueryResult) error { return send(exportEvent{Type: "rows", Result: &result}) })
		if err != nil {
			_ = send(exportEvent{Type: "error", Error: err.Error()})
		} else {
			_ = send(exportEvent{Type: "done"})
		}
	}()
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if write(": heartbeat\n\n") != nil {
				return
			}
		case event, ok := <-events:
			if !ok {
				return
			}
			event.Error = localization.Text(language, event.Error)
			data, err := json.Marshal(event)
			if err != nil {
				failure, _ := json.Marshal(exportEvent{Type: "error", Error: localization.Text(language, "导出数据编码失败")})
				_ = write("data: " + string(failure) + "\n\n")
				return
			}
			if write("data: "+string(data)+"\n\n") != nil {
				return
			}
		}
	}
}
