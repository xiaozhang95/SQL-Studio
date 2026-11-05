package agent

import (
	"context"
	"errors"
	"io/fs"
	model "sql-studio-backend/internal/model/agent"
)

// TurnOutcome is shared by persistence and SSE so restored and live turns agree.
func TurnOutcome(err error) (string, model.Event) {
	if err == nil {
		return "completed", model.Event{}
	}
	e := model.Event{Type: "error", Text: err.Error()}
	switch {
	case errors.Is(err, context.Canceled):
		e.Type, e.Text = "stopped", "已停止，本轮未完成；已执行的操作不保证回滚。"
	case errors.Is(err, errWriteCancelled), errors.Is(err, model.ErrContinueCancelled):
		e.Type = "stopped"
	case errors.Is(err, context.DeadlineExceeded):
		e.Text = "本轮处理超时，已停止；已执行的操作不保证回滚，请缩小问题范围后重试。"
	default:
		var pathError *fs.PathError
		if errors.As(err, &pathError) {
			e.Text = "本机对话记录读写失败，请检查存储空间和目录权限。"
		}
	}
	if e.Type == "stopped" {
		return "cancelled", e
	}
	return "error", e
}
