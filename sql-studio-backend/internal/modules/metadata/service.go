package metadata

import (
	"context"
	"errors"

	"sql-studio-backend/internal/model"
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

func (s *Service) Indexes(ctx context.Context, id, database, table string) ([]model.Index, error) {
	c, err := s.connections.Get(id)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, metadataTimeout)
	defer cancel()
	return s.database.Indexes(ctx, c, model.TableRef{Database: database, Name: table})
}

func (s *Service) ForeignKeys(ctx context.Context, id, database, table string) ([]model.ForeignKey, error) {
	if database == "" || table == "" {
		return nil, errors.New("必须指定数据库和表")
	}
	c, err := s.connections.Get(id)
	if err != nil {
		return nil, err
	}
	reader, ok := s.database.(interface {
		ForeignKeys(context.Context, model.Connection, model.TableRef) ([]model.ForeignKey, error)
	})
	if !ok {
		return []model.ForeignKey{}, nil
	}
	ctx, cancel := context.WithTimeout(ctx, metadataTimeout)
	defer cancel()
	return reader.ForeignKeys(ctx, c, model.TableRef{Database: database, Name: table})
}

func (s *Service) Schemas(ctx context.Context, id, database string) ([]string, error) {
	c, err := s.connections.Get(id)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, metadataTimeout)
	defer cancel()
	return s.database.Schemas(ctx, c, database)
}
