package metadata

import (
	"context"
	"errors"
	"sql-studio-backend/internal/model"
	"time"
)

// StreamTableData is a dedicated read-only export path, separate from query limits.
func (s *Service) StreamTableData(ctx context.Context, id, database, table string, emit func(model.QueryResult) error) error {
	if database == "" || table == "" {
		return errors.New("导出必须指定数据库和表")
	}
	c, err := s.connections.Get(id)
	if err != nil {
		return err
	}
	select {
	case s.exports <- struct{}{}:
		defer func() { <-s.exports }()
	default:
		return errors.New("导出任务过多，请稍后重试")
	}
	exporter, ok := s.database.(interface {
		StreamTableData(context.Context, model.Connection, model.TableRef, func(model.QueryResult) error) error
	})
	if !ok {
		return errors.New("数据库未提供流式导出")
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()
	return exporter.StreamTableData(ctx, c, model.TableRef{Database: database, Name: table}, emit)
}
