package agentstate

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	model "sql-studio-backend/internal/model/agent"
	"time"
)

var partID = regexp.MustCompile(`^[a-f0-9]{64}$`)

type cachedParts struct {
	revision               uint64
	messages               []model.Message
	events                 []model.Event
	messageRefs, eventRefs []string
	used                   time.Time
}

func (s *Store) partPath(id, hash string) string {
	return filepath.Join(s.dir, "conversations", id+"-parts", hash+".json")
}

// Stable chunks preserve completed history without rewriting it at every checkpoint.
func saveParts[T any](ctx context.Context, s *Store, id string, values, previous []T, previousRefs []string) ([]string, error) {
	refs := []string{}
	for start := 0; start < len(values); start += 32 {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		end := start + 32
		if end > len(values) {
			end = len(values)
		}
		chunk := values[start:end]
		part := start / 32
		priorEnd := start + 32
		if priorEnd > len(previous) {
			priorEnd = len(previous)
		}
		if part < len(previousRefs) && priorEnd == end && start < priorEnd && reflect.DeepEqual(chunk, previous[start:priorEnd]) {
			refs = append(refs, previousRefs[part])
			continue
		}
		raw, err := json.Marshal(chunk)
		if err != nil {
			return nil, err
		}
		hash := sha256.Sum256(raw)
		ref := hex.EncodeToString(hash[:])
		path := s.partPath(id, ref)
		if _, err = os.Stat(path); errors.Is(err, os.ErrNotExist) {
			if err = write(ctx, path, chunk); err != nil {
				return nil, err
			}
		} else if err != nil {
			return nil, err
		}
		refs = append(refs, ref)
	}
	return refs, nil
}

func loadParts[T any](ctx context.Context, s *Store, id string, refs []string) ([]T, error) {
	values := []T{}
	for _, ref := range refs {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if !partID.MatchString(ref) {
			return nil, errors.New("会话内容引用无效")
		}
		var chunk []T
		if err := read(s.partPath(id, ref), &chunk); err != nil {
			return nil, err
		}
		raw, err := json.Marshal(chunk)
		if err != nil {
			return nil, err
		}
		hash := sha256.Sum256(raw)
		if hex.EncodeToString(hash[:]) != ref || len(chunk) == 0 || len(chunk) > 32 {
			return nil, errors.New("会话内容损坏，拒绝覆盖")
		}
		values = append(values, chunk...)
	}
	return values, nil
}

func (s *Store) saveRecord(ctx context.Context, value model.Conversation) (record, error) {
	previous := s.parts[value.ID]
	if previous.revision+1 != value.Revision {
		previous = cachedParts{}
	}
	messages, err := saveParts(ctx, s, value.ID, value.Messages, previous.messages, previous.messageRefs)
	if err != nil {
		return record{}, err
	}
	events, err := saveParts(ctx, s, value.ID, value.Events, previous.events, previous.eventRefs)
	if err != nil {
		return record{}, err
	}
	value.Messages, value.Events = nil, nil
	return record{SchemaVersion: 2, Data: value, MessageParts: messages, EventParts: events}, nil
}

func (s *Store) rememberParts(value model.Conversation, manifest record) {
	if s.parts == nil {
		s.parts = map[string]cachedParts{}
	}
	if _, exists := s.parts[value.ID]; !exists && len(s.parts) >= 4 {
		oldest := ""
		for id, cached := range s.parts {
			if oldest == "" || cached.used.Before(s.parts[oldest].used) {
				oldest = id
			}
		}
		delete(s.parts, oldest)
	}
	s.parts[value.ID] = cachedParts{revision: value.Revision, messages: append([]model.Message(nil), value.Messages...), events: append([]model.Event(nil), value.Events...), messageRefs: manifest.MessageParts, eventRefs: manifest.EventParts, used: time.Now()}
}

func (s *Store) collectReplacedParts(id string, old, current record) {
	keep := map[string]bool{}
	for _, ref := range append(current.MessageParts, current.EventParts...) {
		keep[ref] = true
	}
	for _, ref := range append(old.MessageParts, old.EventParts...) {
		if partID.MatchString(ref) && !keep[ref] {
			_ = os.Remove(s.partPath(id, ref))
		}
	}
}
