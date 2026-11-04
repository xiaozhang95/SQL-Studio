package localstate

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"sql-studio-backend/internal/model/agent"
	"strconv"
	"sync"
	"time"
)

const maxFile = 32 * 1024 * 1024

var validID = regexp.MustCompile(`^[a-f0-9]{48}$`)

type Store struct {
	mu  sync.Mutex
	dir string
}
type index struct {
	SchemaVersion int                      `json:"schemaVersion"`
	Items         []model.ConversationInfo `json:"items"`
}
type record struct {
	SchemaVersion int                `json:"schemaVersion"`
	Data          model.Conversation `json:"data"`
}

func New(directory string) *Store { return &Store{dir: directory} }
func read(path string, out interface{}) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	raw, err := io.ReadAll(io.LimitReader(f, maxFile+1))
	if err != nil {
		return err
	}
	if len(raw) > maxFile {
		return errors.New("本地记录超过32MiB限制")
	}
	if json.Unmarshal(raw, out) != nil {
		return errors.New("本地记录损坏，拒绝重置或覆盖")
	}
	return nil
}
func write(ctx context.Context, path string, data interface{}) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}
	if len(raw) > maxFile {
		return errors.New("本地记录已满，请新建对话")
	}
	dir := filepath.Dir(path)
	if err = os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	f, err := os.CreateTemp(dir, ".state-*")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	_, werr := f.Write(raw)
	serr := f.Sync()
	cerr := f.Close()
	if werr != nil {
		return werr
	}
	if serr != nil {
		return serr
	}
	if cerr != nil {
		return cerr
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	return os.Rename(name, path)
}
func (s *Store) loadIndex() (index, error) {
	v := index{}
	err := read(filepath.Join(s.dir, "conversations", "index.json"), &v)
	if errors.Is(err, os.ErrNotExist) {
		return index{SchemaVersion: 1, Items: []model.ConversationInfo{}}, nil
	}
	if err != nil {
		return v, err
	}
	if v.SchemaVersion != 1 || v.Items == nil {
		return v, errors.New("会话索引版本不支持")
	}
	seen := map[string]bool{}
	for _, i := range v.Items {
		if !validID.MatchString(i.ID) || i.Revision == 0 || seen[i.ID] {
			return v, errors.New("会话索引损坏")
		}
		seen[i.ID] = true
	}
	return v, nil
}
func (s *Store) List(ctx context.Context) ([]model.ConversationInfo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	v, err := s.loadIndex()
	sort.Slice(v.Items, func(i, j int) bool { return v.Items[i].UpdatedAt.After(v.Items[j].UpdatedAt) })
	return v.Items, err
}
func (s *Store) Load(ctx context.Context, id string) (model.Conversation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.load(ctx, id)
}
func (s *Store) load(ctx context.Context, id string) (model.Conversation, error) {
	var zero model.Conversation
	if !validID.MatchString(id) {
		return zero, errors.New("无效会话ID")
	}
	if err := ctx.Err(); err != nil {
		return zero, err
	}
	idx, err := s.loadIndex()
	if err != nil {
		return zero, err
	}
	for _, i := range idx.Items {
		if i.ID == id {
			var v record
			err = read(s.path(id, i.Revision), &v)
			if err != nil {
				return zero, err
			}
			if v.SchemaVersion != 1 || v.Data.ID != id || v.Data.Revision != i.Revision || len(v.Data.Messages) == 0 || v.Data.Messages[0].Role != "system" || v.Data.Summary.Through < 0 || v.Data.Summary.Through > len(v.Data.Messages) {
				return zero, errors.New("会话记录版本或内容无效")
			}
			return v.Data, nil
		}
	}
	return zero, os.ErrNotExist
}
func (s *Store) path(id string, revision uint64) string {
	return filepath.Join(s.dir, "conversations", id+"-"+strconv.FormatUint(revision, 10)+".json")
}
func (s *Store) Save(ctx context.Context, value model.Conversation) (model.Conversation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !validID.MatchString(value.ID) {
		return value, errors.New("无效会话ID")
	}
	idx, err := s.loadIndex()
	if err != nil {
		return value, err
	}
	position := -1
	for i, item := range idx.Items {
		if item.ID == value.ID {
			position = i
			if item.Revision != value.Revision {
				return value, model.ErrConflict
			}
			break
		}
	}
	if position < 0 && value.Revision != 0 {
		return value, model.ErrConflict
	}
	old := value.Revision
	if old > 0 {
		if _, err = s.load(ctx, value.ID); err != nil {
			return value, err
		}
	}
	value.Revision++
	value.UpdatedAt = time.Now().UTC()
	if err = write(ctx, s.path(value.ID, value.Revision), record{1, value}); err != nil {
		return value, err
	}
	info := model.ConversationInfo{ID: value.ID, Revision: value.Revision, Title: value.Title, UpdatedAt: value.UpdatedAt, Status: value.Status}
	if position < 0 {
		idx.Items = append(idx.Items, info)
	} else {
		idx.Items[position] = info
	}
	if err = write(ctx, filepath.Join(s.dir, "conversations", "index.json"), idx); err != nil {
		value.Revision = old
		return value, err
	}
	// Only the index revision is authoritative. A crash before index commit leaves an unreferenced part.
	if old > 0 {
		_ = os.Remove(s.path(value.ID, old))
	}
	return value, nil
}
func (s *Store) Delete(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !validID.MatchString(id) {
		return errors.New("无效会话ID")
	}
	idx, err := s.loadIndex()
	if err != nil {
		return err
	}
	for i, item := range idx.Items {
		if item.ID == id {
			idx.Items = append(idx.Items[:i], idx.Items[i+1:]...)
			if err = write(ctx, filepath.Join(s.dir, "conversations", "index.json"), idx); err != nil {
				return err
			}
			_ = os.Remove(s.path(id, item.Revision))
			return nil
		}
	}
	return nil
}
func (s *Store) ReadWorkspace(ctx context.Context) (model.Workspace, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.workspace(ctx)
}
func (s *Store) workspace(ctx context.Context) (model.Workspace, error) {
	fallback := model.Workspace{SchemaVersion: 1, State: model.Layout{Expanded: []string{}}}
	if err := ctx.Err(); err != nil {
		return fallback, err
	}
	var raw struct {
		SchemaVersion *int       `json:"schemaVersion"`
		Revision      *uint64    `json:"revision"`
		UpdatedAt     *time.Time `json:"updatedAt"`
		State         *struct {
			ActiveID *string   `json:"activeId"`
			Draft    *string   `json:"draft"`
			Expanded *[]string `json:"expanded"`
			Mode     string    `json:"mode"`
		} `json:"state"`
	}
	err := read(filepath.Join(s.dir, "layout.json"), &raw)
	if errors.Is(err, os.ErrNotExist) {
		return fallback, nil
	}
	if err != nil {
		return fallback, err
	}
	if raw.SchemaVersion == nil || *raw.SchemaVersion != 1 || raw.Revision == nil || raw.UpdatedAt == nil || raw.State == nil || raw.State.ActiveID == nil || raw.State.Draft == nil || raw.State.Expanded == nil {
		return fallback, errors.New("布局版本或内容损坏，拒绝覆盖")
	}
	state := raw.State
	if (*state.ActiveID != "" && !validID.MatchString(*state.ActiveID)) || len(*state.Draft) > model.MessageMaxBytes || len(*state.Expanded) > 1024 {
		return fallback, errors.New("本地布局范围无效")
	}
	if state.Mode != "" && state.Mode != "readonly" && state.Mode != "write" {
		return model.Workspace{}, errors.New("保存的操作模式无效")
	}
	return model.Workspace{SchemaVersion: 1, Revision: *raw.Revision, UpdatedAt: *raw.UpdatedAt, State: model.Layout{Mode: state.Mode, ActiveID: *state.ActiveID, Draft: *state.Draft, Expanded: *state.Expanded}}, nil
}
func (s *Store) WriteWorkspace(ctx context.Context, input model.Workspace) (model.Workspace, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	old, err := s.workspace(ctx)
	if err != nil {
		return old, err
	}
	if old.Revision != input.Revision {
		return old, model.ErrConflict
	}
	if input.State.Expanded == nil {
		input.State.Expanded = []string{}
	}
	input.SchemaVersion = 1
	input.Revision++
	input.UpdatedAt = time.Now().UTC()
	if err = write(ctx, filepath.Join(s.dir, "layout.json"), input); err != nil {
		return old, err
	}
	return input, nil
}
