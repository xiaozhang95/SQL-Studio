package connections

import "sql-studio-backend/internal/model"

type GroupState struct {
	Groups      []string           `json:"groups"`
	Connections []model.Connection `json:"connections"`
}

func (s *Service) ListGroups() []string                      { return s.connections.Groups() }
func (s *Service) CreateGroup(name string) ([]string, error) { return s.connections.CreateGroup(name) }
func (s *Service) RenameGroup(name, newName string) (GroupState, error) {
	groups, err := s.connections.RenameGroup(name, newName)
	if err != nil {
		return GroupState{}, err
	}
	return GroupState{Groups: groups, Connections: s.ListConnections()}, nil
}
func (s *Service) MoveGroup(id, group string) (model.Connection, error) {
	return s.connections.MoveGroup(id, group)
}
