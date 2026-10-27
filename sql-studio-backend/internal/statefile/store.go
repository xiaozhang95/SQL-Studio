package statefile

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sql-studio-backend/internal/model"
	"sync"
	"time"
)

const maxBytes = 33 * 1024 * 1024

var validName = regexp.MustCompile(`^[a-z][a-z0-9-]{0,47}$`)

type Store struct {
	directory string
	mu        sync.Mutex
}

func Open(directory string) (*Store, error) {
	if directory == "" {
		return nil, errors.New("配置目录不能为空")
	}
	if err := os.MkdirAll(directory, 0700); err != nil {
		return nil, err
	}
	return &Store{directory: directory}, nil
}
func (s *Store) read(name string) (model.StateDocument, error) {
	if !validName.MatchString(name) || name == model.ConnectionsSection {
		return model.StateDocument{}, errors.New("配置名称无效")
	}
	file, err := os.Open(filepath.Join(s.directory, name+".json"))
	if errors.Is(err, os.ErrNotExist) {
		return model.StateDocument{SchemaVersion: 1, Data: json.RawMessage("null")}, nil
	}
	if err != nil {
		return model.StateDocument{}, err
	}
	defer file.Close()
	bytes, err := io.ReadAll(io.LimitReader(file, maxBytes+1))
	if err != nil {
		return model.StateDocument{}, err
	}
	if len(bytes) > maxBytes {
		return model.StateDocument{}, errors.New("配置文件过大")
	}
	var doc model.StateDocument
	if err = json.Unmarshal(bytes, &doc); err != nil {
		return doc, fmt.Errorf("配置文件损坏，已保留原文件: %w", err)
	}
	var data map[string]json.RawMessage
	if doc.SchemaVersion != 1 || doc.Revision == 0 || json.Unmarshal(doc.Data, &data) != nil || data == nil {
		return doc, errors.New("配置版本或内容不受支持，已保留原文件")
	}
	return doc, nil
}
func (s *Store) Read(ctx context.Context, name string) (model.StateDocument, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return model.StateDocument{}, err
	}
	return s.read(name)
}
func (s *Store) Write(ctx context.Context, name string, input model.StateWrite) (model.StateDocument, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return model.StateDocument{}, err
	}
	old, err := s.read(name)
	if err != nil {
		return old, err
	}
	if old.Revision != 0 && old.Revision != input.Revision {
		return old, model.ErrStateConflict
	}
	if old.Revision == 0 {
		old.Revision = input.Revision
	}
	old.SchemaVersion = 1
	old.Revision++
	old.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	old.Data = input.Data
	bytes, err := json.MarshalIndent(old, "", "  ")
	if err != nil {
		return old, err
	}
	if len(bytes)+1 > maxBytes {
		return old, errors.New("配置文件超过大小限制，未覆盖原文件")
	}
	if err = os.MkdirAll(s.directory, 0700); err != nil {
		return old, err
	}
	tmp, err := os.CreateTemp(s.directory, ".state-*.tmp")
	if err != nil {
		return old, err
	}
	defer os.Remove(tmp.Name())
	if err = tmp.Chmod(0600); err == nil {
		_, err = tmp.Write(append(bytes, '\n'))
	}
	if err == nil {
		err = tmp.Sync()
	}
	closeErr := tmp.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return old, err
	}
	if err = ctx.Err(); err != nil {
		return old, err
	}
	if err = os.Rename(tmp.Name(), filepath.Join(s.directory, name+".json")); err != nil {
		return old, err
	}
	return old, nil
}
