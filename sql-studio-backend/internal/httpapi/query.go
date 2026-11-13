package httpapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"sql-studio-backend/internal/localization"
	"sql-studio-backend/internal/model"
)

const maxQueryBatchRequestBytes = 2 * maxRequestBytes

func (h *handler) query(c *gin.Context) {
	var input model.QueryRequest
	if err := decode(c, &input); err != nil {
		fail(c, err)
		return
	}
	result, err := h.queries.Query(c.Request.Context(), c.Param("id"), input)
	if err != nil {
		fail(c, err)
		return
	}
	respond(c, 200, result)
}

type queryBatchEvent struct {
	Type string `json:"type"`
	model.QueryBatchStep
}

func (h *handler) queryBatch(c *gin.Context) {
	var input model.QueryBatchRequest
	if err := decodeLimit(c, &input, maxQueryBatchRequestBytes); err != nil {
		fail(c, err)
		return
	}
	control := http.NewResponseController(c.Writer)
	encoder := json.NewEncoder(c.Writer)
	language := languageFor(c)
	write := func(event queryBatchEvent) error {
		if err := c.Request.Context().Err(); err != nil {
			return err
		}
		if !c.Writer.Written() {
			c.Header("Content-Type", "application/x-ndjson; charset=utf-8")
			c.Header("Cache-Control", "no-store")
			c.Header("X-Accel-Buffering", "no")
		}
		_ = control.SetWriteDeadline(time.Now().Add(40 * time.Second))
		event.Error = localization.Text(language, event.Error)
		if err := encoder.Encode(event); err != nil {
			return err
		}
		return control.Flush()
	}
	err := h.queries.Batch(c.Request.Context(), c.Param("id"), input, func(step model.QueryBatchStep) error {
		return write(queryBatchEvent{Type: "statement", QueryBatchStep: step})
	})
	if err == nil {
		_ = write(queryBatchEvent{Type: "done"})
	} else if !c.Writer.Written() {
		fail(c, err)
	} else {
		_ = write(queryBatchEvent{Type: "error", QueryBatchStep: model.QueryBatchStep{Error: err.Error()}})
	}
}
