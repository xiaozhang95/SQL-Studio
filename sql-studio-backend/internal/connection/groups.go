package connection

import (
	"errors"
	"os"
	"sort"
	"strings"
	"unicode"

	"sql-studio-backend/internal/model"
)

func allGroups(items []model.Connection, groups []string) []string {
	seen := map[string]bool{model.NormalizeConnectionGroup(""): true}
	for _, group := range groups {
		seen[model.NormalizeConnectionGroup(group)] = true
	}
	for _, item := range items {
		seen[model.NormalizeConnectionGroup(item.Group)] = true
	}
	result := []string{model.NormalizeConnectionGroup("")}
	delete(seen, result[0])
	rest := make([]string, 0, len(seen))
	for group := range seen {
		rest = append(rest, group)
	}
	sort.Strings(rest)
	return append(result, rest...)
}

func groupName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" || strings.ContainsFunc(name, unicode.IsControl) {
		return "", errors.New("请输入有效的分组名称")
	}
	return name, nil
}

func containsGroup(groups []string, name string) bool {
	for _, group := range groups {
		if group == name {
			return true
		}
	}
	return false
}

// Groups 包括默认分组、空分组及所有连接的归属，返回独立切片。
func (s *Store) Groups() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return allGroups(s.items, s.groups)
}

func (s *Store) CreateGroup(name string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	name, err := groupName(name)
	if err != nil {
		return nil, err
	}
	groups := allGroups(s.items, s.groups)
	if containsGroup(groups, name) {
		return nil, errors.New("分组名称已存在")
	}
	if err = s.persistGroups(s.items, append(groups, name)); err != nil {
		return nil, err
	}
	return allGroups(s.items, s.groups), nil
}

// RenameGroup 在同一次原子替换中重命名分组及其连接，保留密码密文和连接 ID。
func (s *Store) RenameGroup(name, newName string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	name, err := groupName(name)
	if err != nil {
		return nil, err
	}
	newName, err = groupName(newName)
	if err != nil {
		return nil, err
	}
	groups := allGroups(s.items, s.groups)
	if name == model.NormalizeConnectionGroup("") {
		return nil, errors.New("默认分组不能重命名")
	}
	if !containsGroup(groups, name) {
		return nil, os.ErrNotExist
	}
	if name == newName {
		return groups, nil
	}
	if containsGroup(groups, newName) {
		return nil, errors.New("分组名称已存在")
	}
	for i := range groups {
		if groups[i] == name {
			groups[i] = newName
		}
	}
	items := append([]model.Connection{}, s.items...)
	for i := range items {
		if model.NormalizeConnectionGroup(items[i].Group) == name {
			items[i].Group = newName
		}
	}
	if err = s.persistGroups(items, groups); err != nil {
		return nil, err
	}
	return allGroups(s.items, s.groups), nil
}

func (s *Store) MoveGroup(id, group string) (model.Connection, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	group, err := groupName(group)
	if err != nil {
		return model.Connection{}, err
	}
	if !containsGroup(allGroups(s.items, s.groups), group) {
		return model.Connection{}, errors.New("目标分组不存在")
	}
	items := append([]model.Connection{}, s.items...)
	for i := range items {
		if items[i].ID != id {
			continue
		}
		items[i].Group = group
		if err = s.persist(items); err != nil {
			return model.Connection{}, err
		}
		result := items[i]
		result.Type = model.NormalizeDatabaseType(result.Type)
		result.HasPassword = result.Password != ""
		result.Password = ""
		return result, nil
	}
	return model.Connection{}, os.ErrNotExist
}

// DeleteGroup removes the folder and moves its members to the default group atomically.
// Connection IDs, credential ciphertext and every other connection field stay unchanged.
func (s *Store) DeleteGroup(name string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	name, err := groupName(name)
	if err != nil {
		return nil, err
	}
	if name == model.DefaultConnectionGroup {
		return nil, errors.New("默认分组不能删除")
	}
	groups := allGroups(s.items, s.groups)
	if !containsGroup(groups, name) {
		return nil, os.ErrNotExist
	}
	remaining := make([]string, 0, len(groups)-1)
	for _, group := range groups {
		if group != name {
			remaining = append(remaining, group)
		}
	}
	items := append([]model.Connection{}, s.items...)
	for i := range items {
		if model.NormalizeConnectionGroup(items[i].Group) == name {
			items[i].Group = model.DefaultConnectionGroup
		}
	}
	if err = s.persistGroups(items, remaining); err != nil {
		return nil, err
	}
	return allGroups(s.items, s.groups), nil
}
