package metadata

import (
	"context"

	"sql-studio/internal/model"
)

func (s *Service) Databases(ctx context.Context, id string) ([]string, error) {
	c, err := s.connections.Get(id)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, metadataTimeout)
	defer cancel()
	return s.database.Databases(ctx, c)
}

func (s *Service) Tables(ctx context.Context, id, database string) ([]model.Table, error) {
	c, err := s.connections.Get(id)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, metadataTimeout)
	defer cancel()
	return s.database.Tables(ctx, c, database)
}

func (s *Service) Columns(ctx context.Context, id, database, table string) ([]model.Column, error) {
	c, err := s.connections.Get(id)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, metadataTimeout)
	defer cancel()
	return s.database.Columns(ctx, c, model.TableRef{Database: database, Name: table})
}

func (s *Service) DDL(ctx context.Context, id, database, table string) (string, error) {
	c, err := s.connections.Get(id)
	if err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(ctx, metadataTimeout)
	defer cancel()
	return s.database.DDL(ctx, c, model.TableRef{Database: database, Name: table})
}
