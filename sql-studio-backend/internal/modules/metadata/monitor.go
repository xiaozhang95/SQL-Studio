package metadata

import (
	"context"
	"errors"
	"time"

	"sql-studio-backend/internal/model"
)

func (s *Service) Monitor(ctx context.Context, id, database string) (model.MonitorSnapshot, error) {
	connection, err := s.connections.Get(id)
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	executor, ok := s.database.(interface {
		Monitor(context.Context, model.Connection, string) (model.MonitorSnapshot, error)
	})
	if !ok {
		return model.MonitorSnapshot{}, errors.New("该数据库类型暂不支持监控")
	}
	ctx, cancel := context.WithTimeout(ctx, metadataTimeout)
	defer cancel()
	snapshot, err := executor.Monitor(ctx, connection, database)
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	if len(snapshot.Metrics) == 0 {
		return model.MonitorSnapshot{}, errors.New("未读取到数据库统计")
	}
	snapshot.SampledAt = time.Now().UTC()
	return snapshot, nil
}
