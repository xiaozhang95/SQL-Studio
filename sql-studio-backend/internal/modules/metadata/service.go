package metadata

import (
	"context"
	"errors"

	"sql-studio-backend/internal/model"
)

var errOracleDDLTimeout = errors.New("读取 Oracle DDL 超时，请重试。")

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
	ref := model.TableRef{Database: database, Name: table}
	if c.Type == model.TypeOracle {
		// DBMS_METADATA can spend longer loading its catalog on the first call.
		ctx, cancel := context.WithTimeoutCause(ctx, oracleDDLTimeout, errOracleDDLTimeout)
		defer cancel()
		ddl, err := s.database.DDL(ctx, c, ref)
		if err != nil && ctx.Err() != nil {
			return "", context.Cause(ctx)
		}
		return ddl, err
	}
	ctx, cancel := context.WithTimeout(ctx, metadataTimeout)
	defer cancel()
	return s.database.DDL(ctx, c, ref)
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
