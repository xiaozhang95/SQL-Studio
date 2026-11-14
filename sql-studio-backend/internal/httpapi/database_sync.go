package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"sql-studio-backend/internal/localization"
	"sql-studio-backend/internal/model"
)

type databaseSyncEvent struct {
	Type     string                      `json:"type"`
	Progress *model.DatabaseSyncProgress `json:"progress,omitempty"`
	Error    string                      `json:"error,omitempty"`
}

func (h *handler) listSyncDatabases(c *gin.Context) {
	if h.databaseSync == nil {
		respond(c, http.StatusServiceUnavailable, gin.H{"error": "数据库同步不可用"})
		return
	}
	var input model.DatabaseSyncConnection
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	names, err := h.databaseSync.Databases(c.Request.Context(), input)
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, http.StatusOK, names)
}

func (h *handler) checkDatabaseSync(c *gin.Context) {
	if h.databaseSync == nil {
		respond(c, http.StatusServiceUnavailable, gin.H{"error": "数据库同步不可用"})
		return
	}
	var input model.DatabaseSyncRequest
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	plan, err := h.databaseSync.Check(c.Request.Context(), input)
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, http.StatusOK, plan)
}

func (h *handler) runDatabaseSync(c *gin.Context) {
	if h.databaseSync == nil {
		respond(c, http.StatusServiceUnavailable, gin.H{"error": "数据库同步不可用"})
		return
	}
	var input model.DatabaseSyncRequest
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()
	c.Header("Content-Type", "application/x-ndjson; charset=utf-8")
	c.Header("Cache-Control", "no-store")
	c.Header("X-Accel-Buffering", "no")
	writer := http.NewResponseController(c.Writer)
	language := languageFor(c)
	write := func(event databaseSyncEvent) error {
		_ = writer.SetWriteDeadline(time.Now().Add(30 * time.Second))
		if err := json.NewEncoder(c.Writer).Encode(event); err != nil {
			return err
		}
		c.Writer.Flush()
		return nil
	}
	if write(databaseSyncEvent{Type: "heartbeat"}) != nil {
		return
	}
	events := make(chan databaseSyncEvent)
	go func() {
		defer close(events)
		send := func(event databaseSyncEvent) error {
			select {
			case events <- event:
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		err := h.databaseSync.Run(ctx, input, func(progress model.DatabaseSyncProgress) error {
			return send(databaseSyncEvent{Type: "progress", Progress: &progress})
		})
		if err != nil {
			message := err.Error()
			if errors.Is(err, context.DeadlineExceeded) {
				message = "数据库同步超时"
			}
			_ = send(databaseSyncEvent{Type: "error", Error: localization.Text(language, message)})
			return
		}
		_ = send(databaseSyncEvent{Type: "done"})
	}()
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-events:
			if !ok || write(event) != nil {
				return
			}
		case <-ticker.C:
			if write(databaseSyncEvent{Type: "heartbeat"}) != nil {
				return
			}
		}
	}
}
