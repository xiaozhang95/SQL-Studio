package agent

import (
	"context"
	"sync"
	"time"
)

type turnBudgetKey struct{}

type turnBudget struct {
	mu        sync.Mutex
	timer     *time.Timer
	remaining time.Duration
	started   time.Time
	cancel    context.CancelCauseFunc
}

func newTurnBudget(parent context.Context, duration time.Duration) (context.Context, func()) {
	ctx, cancel := context.WithCancelCause(parent)
	budget := &turnBudget{remaining: duration, cancel: cancel}
	budget.resume()
	return context.WithValue(ctx, turnBudgetKey{}, budget), func() {
		budget.pause()
		cancel(nil)
	}
}

func (b *turnBudget) resume() {
	b.mu.Lock()
	defer b.mu.Unlock()
	started := time.Now()
	b.started = started
	b.timer = time.AfterFunc(b.remaining, func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		if b.started == started {
			b.cancel(context.DeadlineExceeded)
		}
	})
}

func (b *turnBudget) pause() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.timer.Stop()
	b.remaining -= time.Since(b.started)
	b.started = time.Time{}
	if b.remaining <= 0 {
		b.cancel(context.DeadlineExceeded)
	}
}
