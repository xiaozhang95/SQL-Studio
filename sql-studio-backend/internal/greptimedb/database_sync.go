package greptimedb

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/mysql"
)

type syncTable struct{ name, ddl string }
type syncPlan struct {
	model.DatabaseSyncPlan
	tables []syncTable
}

func (c *Client) SyncDatabases(ctx context.Context, connection model.Connection) ([]string, error) {
	return c.wire.SyncDatabases(ctx, connection)
}

func (c *Client) CheckDatabaseSync(ctx context.Context, source, target model.Connection, input model.DatabaseSyncRequest) (model.DatabaseSyncPlan, error) {
	plan, err := c.checkSync(ctx, source, target, input)
	return plan.DatabaseSyncPlan, err
}

func (c *Client) checkSync(ctx context.Context, source, target model.Connection, input model.DatabaseSyncRequest) (syncPlan, error) {
	var plan syncPlan
	for _, db := range []string{input.SourceDatabase, input.TargetDatabase} {
		if strings.EqualFold(db, "information_schema") || strings.EqualFold(db, "public") && strings.EqualFold(db, input.TargetDatabase) {
			return plan, errors.New("目标数据库已存在，同步已停止")
		}
	}
	names, err := c.SyncDatabases(ctx, target)
	if err != nil {
		return plan, err
	}
	if slices.ContainsFunc(names, func(name string) bool { return strings.EqualFold(name, input.TargetDatabase) }) {
		return plan, errors.New("目标数据库已存在，同步已停止")
	}
	if !input.CreateDatabase {
		return plan, errors.New("目标数据库不存在，请勾选允许新建目标库")
	}
	sourceNames, err := c.SyncDatabases(ctx, source)
	if err != nil {
		return plan, err
	}
	if !slices.Contains(sourceNames, input.SourceDatabase) {
		return plan, errors.New("源数据库不存在或不可访问")
	}
	tables, err := c.Tables(ctx, source, input.SourceDatabase)
	if err != nil {
		return plan, err
	}
	for _, table := range tables {
		if table.Type == "VIEW" {
			plan.SkippedViews++
			continue
		}
		if table.Type != "BASE TABLE" {
			return plan, fmt.Errorf("表结构包含暂不支持的定义：%s", table.Name)
		}
		ddl, err := c.wire.DDL(ctx, source, model.TableRef{Database: input.SourceDatabase, Name: table.Name})
		if err != nil {
			return plan, err
		}
		ddl, err = greptimeTableDefinition(table.Name, ddl)
		if err != nil {
			return plan, err
		}
		plan.tables = append(plan.tables, syncTable{name: table.Name, ddl: ddl})
	}
	plan.Tables = len(plan.tables)
	if plan.Tables == 0 {
		return plan, errors.New("源库没有可同步的普通表")
	}
	return plan, nil
}

var syncMitoEngine = regexp.MustCompile(`(?i)\)\s*ENGINE\s*=\s*(?:mito\b|"mito"|'mito'|` + "`mito`" + `)`)
var syncCreatePrefix = regexp.MustCompile("(?i)^CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?")

func greptimeTableDefinition(name, ddl string) (string, error) {
	ddl = strings.TrimSpace(ddl)
	if !syncCreatePrefix.MatchString(ddl) {
		return "", fmt.Errorf("表结构包含暂不支持的定义：%s", name)
	}
	body := syncCreatePrefix.ReplaceAllString(ddl, "")
	simple := []string{quoteIdentifier(name), `"` + strings.ReplaceAll(name, `"`, `""`) + `"`, name}
	for _, identifier := range simple {
		if strings.HasPrefix(body, identifier) && strings.HasPrefix(strings.TrimSpace(body[len(identifier):]), "(") {
			options := body[len(identifier):]
			if _, err := statementWords(ddl, false); err != nil {
				return "", err
			}
			if syncMitoEngine.MatchString(options) {
				return "CREATE TABLE " + quoteIdentifier(name) + " " + strings.TrimSpace(options), nil
			}
		}
	}
	return "", fmt.Errorf("仅支持同步 GreptimeDB Mito 普通表：%s", name)
}

func (c *Client) SyncDatabase(ctx context.Context, source, target model.Connection, input model.DatabaseSyncRequest, emit func(model.DatabaseSyncProgress) error) error {
	progress := model.DatabaseSyncProgress{Phase: "checking"}
	if err := emit(progress); err != nil {
		return err
	}
	plan, err := c.checkSync(ctx, source, target, input)
	if err != nil {
		return err
	}
	progress.Tables, progress.SkippedViews = plan.Tables, plan.SkippedViews
	_, err = c.Execute(ctx, target, model.QueryRequest{AllowWrite: true, SQL: "CREATE DATABASE " + quoteIdentifier(input.TargetDatabase)})
	if err != nil {
		return err
	}
	progress.Created, progress.Phase = true, "created"
	if err = emit(progress); err != nil {
		return err
	}
	targetDB, err := mysql.Open(target, input.TargetDatabase)
	if err != nil {
		return err
	}
	defer targetDB.Close()
	sourceDB, err := mysql.Open(source, input.SourceDatabase)
	if err != nil {
		return err
	}
	defer sourceDB.Close()
	for _, table := range plan.tables {
		progress.Table, progress.Phase = table.name, "structure"
		if err = emit(progress); err != nil {
			return err
		}
		if _, err = targetDB.ExecContext(ctx, table.ddl); err != nil {
			return err
		}
		if input.Data {
			progress.Phase = "data"
			if err = emit(progress); err != nil {
				return err
			}
			if err = copyGreptimeRows(ctx, sourceDB, targetDB, table.name, func(count int64) error {
				progress.Rows += count
				return emit(progress)
			}); err != nil {
				return err
			}
		}
		progress.Completed++
		progress.Phase = "table_done"
		if err = emit(progress); err != nil {
			return err
		}
	}
	return nil
}
