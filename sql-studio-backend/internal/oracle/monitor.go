package oracle

import (
	"context"
	"strings"

	"sql-studio-backend/internal/model"
)

func (c *Client) Monitor(ctx context.Context, connection model.Connection, service string) (model.MonitorSnapshot, error) {
	service, err := configuredService(connection, service)
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	ctx, db, release, err := c.openRequest(ctx, connection, service)
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	defer release()
	result := model.MonitorSnapshot{Database: service, Metrics: []model.MonitorMetric{}, Details: &model.MonitorDetails{Sections: []model.MonitorSection{}}}
	var database, instance, container, schema string
	err = db.QueryRowContext(ctx, `SELECT SYS_CONTEXT('USERENV','DB_UNIQUE_NAME'), SYS_CONTEXT('USERENV','INSTANCE_NAME'),
       SYS_CONTEXT('USERENV','CON_NAME'), SYS_CONTEXT('USERENV','SESSION_USER') FROM DUAL`).Scan(&database, &instance, &container, &schema)
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	result.Details.Identity = strings.Join([]string{database, instance, container, schema}, "/")
	if err := db.QueryRowContext(ctx, versionSQL).Scan(&result.Details.Version); err != nil {
		result.Details.Warnings = append(result.Details.Warnings, "Oracle 版本信息不可用")
	}
	var tables, views, indexes, invalid string
	err = db.QueryRowContext(ctx, `SELECT
  TO_CHAR(COUNT(CASE WHEN OBJECT_TYPE='TABLE' THEN 1 END)),
  TO_CHAR(COUNT(CASE WHEN OBJECT_TYPE='VIEW' THEN 1 END)),
  TO_CHAR(COUNT(CASE WHEN OBJECT_TYPE='INDEX' THEN 1 END)),
  TO_CHAR(COUNT(CASE WHEN STATUS='INVALID' THEN 1 END))
FROM USER_OBJECTS`).Scan(&tables, &views, &indexes, &invalid)
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	result.Metrics = append(result.Metrics, model.MonitorMetric{Key: "tables", Value: tables},
		model.MonitorMetric{Key: "views", Value: views}, model.MonitorMetric{Key: "indexes", Value: indexes},
		model.MonitorMetric{Key: "invalid_objects", Value: invalid})
	result.Details.Sections = append(result.Details.Sections,
		model.MonitorSection{Key: "instance", Fields: []model.MonitorMetric{
			{Key: "database_name", Value: database}, {Key: "instance_name", Value: instance},
			{Key: "container_name", Value: container}, {Key: "session_user", Value: schema},
		}},
		model.SelectMonitorSection("catalog", result.Metrics, "tables", "views", "indexes", "invalid_objects"))
	var sessions, active string
	err = db.QueryRowContext(ctx, `SELECT TO_CHAR(COUNT(*)), TO_CHAR(COUNT(CASE WHEN STATUS='ACTIVE' THEN 1 END))
FROM V$SESSION WHERE TYPE='USER' AND CON_ID=TO_NUMBER(SYS_CONTEXT('USERENV','CON_ID'))`).Scan(&sessions, &active)
	if err != nil {
		if ctx.Err() != nil {
			return model.MonitorSnapshot{}, ctx.Err()
		}
		result.Details.Warnings = append(result.Details.Warnings, "Oracle 会话指标不可用，需要 V$SESSION 读取权限")
	} else {
		result.Metrics = append(result.Metrics, model.MonitorMetric{Key: "sessions", Value: sessions}, model.MonitorMetric{Key: "active_sessions", Value: active})
		result.Details.Sections = append(result.Details.Sections, model.SelectMonitorSection("connections", result.Metrics, "sessions", "active_sessions"))
	}
	return result, nil
}
