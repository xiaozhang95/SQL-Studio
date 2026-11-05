package agent

import "context"

type leaseKey struct{}

// A turn owns a slot only while doing work, never while waiting for a person.
type turnLease struct {
	slots chan struct{}
	held  bool
}

func (l *turnLease) release() {
	if l.held {
		<-l.slots
		l.held = false
	}
}

func (l *turnLease) acquire(ctx context.Context) error {
	if err := context.Cause(ctx); err != nil {
		return err
	}
	select {
	case l.slots <- struct{}{}:
		l.held = true
		if err := context.Cause(ctx); err != nil {
			l.release()
			return err
		}
		return nil
	case <-ctx.Done():
		return context.Cause(ctx)
	}
}
