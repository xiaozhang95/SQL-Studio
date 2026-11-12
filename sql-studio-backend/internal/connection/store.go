// Package connection 实现本地连接信息的加密存储，不处理 HTTP 或数据库请求。
package connection

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"sql-studio-backend/internal/model"
)

type Store struct {
	mu     sync.RWMutex
	path   string
	aead   cipher.AEAD
	items  []model.Connection
	groups []string
}

func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

// Open 复用现有 connections.json 与 master.key；密钥丢失时拒绝覆盖已有配置。
func Open(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	keyPath := filepath.Join(dir, "master.key")
	key, err := os.ReadFile(keyPath)
	if os.IsNotExist(err) {
		if _, e := os.Stat(filepath.Join(dir, "connections.json")); !os.IsNotExist(e) {
			return nil, errors.New("master.key missing; restore the key before starting")
		}
		key = make([]byte, 32)
		if _, err = rand.Read(key); err != nil {
			return nil, err
		}
		err = os.WriteFile(keyPath, key, 0600)
	}
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	s := &Store{path: filepath.Join(dir, "connections.json"), aead: aead, items: []model.Connection{}}
	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return s, nil
	}
	if err != nil {
		return nil, err
	}
	var document struct {
		Connections []model.Connection `json:"connections"`
		Groups      []string           `json:"groups"`
	}
	err = json.Unmarshal(data, &document)
	if err == nil && (document.Connections == nil || document.Groups == nil) {
		err = errors.New("invalid connections document")
	}
	s.items, s.groups = document.Connections, document.Groups
	if err != nil {
		return nil, err
	}
	for _, item := range s.items {
		if item.Type == "" || item.Group == "" {
			return nil, errors.New("connections document requires type and group")
		}
	}
	return s, nil
}

func (s *Store) encrypt(value string) (string, error) {
	nonce := make([]byte, s.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(s.aead.Seal(nonce, nonce, []byte(value), nil)), nil
}
func (s *Store) decrypt(value string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return "", err
	}
	n := s.aead.NonceSize()
	if len(data) < n {
		return "", errors.New("invalid encrypted password")
	}
	v, err := s.aead.Open(nil, data[:n], data[n:], nil)
	return string(v), err
}

// List 只返回公开信息，禁止将加密密码或解密密码带到列表响应中。
func (s *Store) List() []model.Connection {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]model.Connection, 0, len(s.items))
	for _, c := range s.items {
		c.Type = model.NormalizeDatabaseType(c.Type)
		c.HasPassword = c.Password != ""
		c.Password = ""
		out = append(out, c)
	}
	return out
}

// Get 仅供服务端建立数据库连接，返回解密凭据。
func (s *Store) Get(id string) (model.Connection, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, c := range s.items {
		if c.ID == id {
			c.Type = model.NormalizeDatabaseType(c.Type)
			p, err := s.decrypt(c.Password)
			c.Password = p
			return c, err
		}
	}
	return model.Connection{}, os.ErrNotExist
}

// persist 先写临时文件再替换配置；成功后才更新内存，避免保存失败时状态分叉。
func (s *Store) persist(items []model.Connection) error {
	return s.persistGroups(items, allGroups(s.items, s.groups))
}

func (s *Store) persistGroups(items []model.Connection, groups []string) error {
	groups = allGroups(items, groups)
	data, err := json.MarshalIndent(struct {
		Connections []model.Connection `json:"connections"`
		Groups      []string           `json:"groups"`
	}{items, groups}, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err = os.WriteFile(tmp, data, 0600); err != nil {
		return err
	}
	if err = os.Rename(tmp, s.path); err != nil {
		return err
	}
	s.items = items
	s.groups = groups
	return nil
}

func (s *Store) Save(c model.Connection) (model.Connection, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c.Type = model.NormalizeDatabaseType(c.Type)
	group, err := groupName(model.NormalizeConnectionGroup(c.Group))
	if err != nil {
		return model.Connection{}, err
	}
	c.Group = group
	items := append([]model.Connection{}, s.items...)
	idx := -1
	if c.ID != "" {
		for i, old := range items {
			if old.ID == c.ID {
				idx = i
				if c.Password == "" {
					p, err := s.decrypt(old.Password)
					if err != nil {
						return c, err
					}
					c.Password = p
				}
				break
			}
		}
		if idx < 0 {
			return c, os.ErrNotExist
		}
	} else {
		c.ID = newID()
	}
	encrypted, err := s.encrypt(c.Password)
	if err != nil {
		return c, err
	}
	c.Password = encrypted
	if idx < 0 {
		items = append(items, c)
	} else {
		items[idx] = c
	}
	if err = s.persist(items); err != nil {
		return c, err
	}
	c.Password = ""
	c.HasPassword = true
	return c, nil
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	items := []model.Connection{}
	found := false
	for _, c := range s.items {
		if c.ID == id {
			found = true
		} else {
			items = append(items, c)
		}
	}
	if !found {
		return os.ErrNotExist
	}
	return s.persist(items)
}
