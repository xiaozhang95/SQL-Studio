package service

import (
	"context"
	"sqldesk/internal/model"
)

// DatabaseRegistry 只选择已注入的协议实现，不依赖具体驱动。Oracle 兼容版使用 PostgreSQL 协议。
type DatabaseRegistry struct {
	mysql    Database
	postgres Database
}

func NewDatabaseRegistry(mysql, postgres Database) *DatabaseRegistry {
	return &DatabaseRegistry{mysql: mysql, postgres: postgres}
}
func (r *DatabaseRegistry) driver(c model.Connection) Database {
	if model.IsPostgres(c.Type) {
		return r.postgres
	}
	return r.mysql
}
func (r *DatabaseRegistry) Test(ctx context.Context, c model.Connection) (string, error) {
	return r.driver(c).Test(ctx, c)
}
func (r *DatabaseRegistry) Databases(ctx context.Context, c model.Connection) ([]string, error) {
	return r.driver(c).Databases(ctx, c)
}
func (r *DatabaseRegistry) Tables(ctx context.Context, c model.Connection, database string) ([]model.Table, error) {
	return r.driver(c).Tables(ctx, c, database)
}
func (r *DatabaseRegistry) Columns(ctx context.Context, c model.Connection, table model.TableRef) ([]model.Column, error) {
	return r.driver(c).Columns(ctx, c, table)
}
func (r *DatabaseRegistry) DDL(ctx context.Context, c model.Connection, table model.TableRef) (string, error) {
	return r.driver(c).DDL(ctx, c, table)
}
func (r *DatabaseRegistry) Execute(ctx context.Context, c model.Connection, input model.QueryRequest) (model.QueryResult, error) {
	return r.driver(c).Execute(ctx, c, input)
}
