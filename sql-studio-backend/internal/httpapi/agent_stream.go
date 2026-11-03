package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"net/http"
	model "sql-studio-backend/internal/model/agent"
	"time"
)

func (h *agentHandler) stream(c *gin.Context) {
	w, r := c.Writer, c.Request
	var input struct {
		SessionID string `json:"sessionId"`
		Mode      string `json:"mode"`
		Message   string `json:"message"`
	}
	if err := decodeLimit(c, &input, 32*1024); err != nil {
		fail(c, err)
		return
	}
	if input.Mode == "" {
		input.Mode = "readonly"
	}
	if input.Mode != "readonly" && input.Mode != "write" {
		fail(c, fmt.Errorf("无效操作模式"))
		return
	}
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Accel-Buffering", "no")
	rc := http.NewResponseController(w)
	emit := func(event model.Event) error {
		_ = rc.SetWriteDeadline(time.Now().Add(20 * time.Second))
		data, err := json.Marshal(event)
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
			return err
		}
		return rc.Flush()
	}
	// Keep the connection alive during long model requests; writes stay serialized in this handler.
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	events := make(chan model.Event)
	done := make(chan error, 1)
	completed := false
	defer func() {
		cancel()
		if !completed {
			<-done
		}
	}()
	go func() {
		done <- h.chat.ChatMode(ctx, input.SessionID, input.Message, input.Mode, func(e model.Event) error {
			select {
			case events <- e:
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		})
	}()
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case event := <-events:
			if emit(event) != nil {
				return
			}
		case err := <-done:
			completed = true
			if err != nil {
				_ = emit(model.Event{Type: "error", Text: err.Error()})
			}
			_ = emit(model.Event{Type: "done"})
			return
		case <-ticker.C:
			if emit(model.Event{Type: "heartbeat"}) != nil {
				return
			}
		case <-ctx.Done():
			return
		}
	}
}
