package mysql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"

	driver "github.com/go-sql-driver/mysql"
	"sql-studio-backend/internal/model"
)

var syncDBOption = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

// SHOW CREATE quotes identifiers. Consume strings, identifiers and comments before
// inspecting SQL words so comments, defaults and table names cannot match options.
var syncDDLTokens = regexp.MustCompile("(?s)'(?:''|\\\\.|[^'\\\\])*'|`(?:``|[^`])*`|/\\*.*?\\*/|[A-Za-z_][A-Za-z_0-9]*|\\.")

type syncTable struct {
	name, ddl string
	columns   []string
}

type syncPlan struct {
	model.DatabaseSyncPlan
	charset, collation string
	tables             []syncTable
}

type syncSource interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func (c *Client) CheckDatabaseSync(ctx context.Context, source, target model.Connection, input model.DatabaseSyncRequest) (model.DatabaseSyncPlan, error) {
	var result model.DatabaseSyncPlan
	err := c.withSyncConnections(ctx, source, target, input, func(ctx context.Context, from, to *sql.Conn) error {
		if err := configureSyncSource(ctx, from); err != nil {
			return err
		}
		plan, err := prepareDatabaseSync(ctx, from, to, input, source.Type)
		result = plan.DatabaseSyncPlan
		return err
	})
	return result, err
}

func (c *Client) SyncDatabase(ctx context.Context, source, target model.Connection, input model.DatabaseSyncRequest, emit func(model.DatabaseSyncProgress) error) error {
	return c.withSyncConnections(ctx, source, target, input, func(ctx context.Context, from, to *sql.Conn) error {
		progress := model.DatabaseSyncProgress{Phase: "checking"}
		if err := emit(progress); err != nil {
			return err
		}
		if err := configureSyncSource(ctx, from); err != nil {
			return err
		}
		tx, err := from.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
		if err != nil {
			return err
		}
		defer tx.Rollback()
		plan, err := prepareDatabaseSync(ctx, tx, to, input, source.Type)
		if err != nil {
			return err
		}
		progress.Tables = plan.Tables
		progress.SkippedViews = plan.SkippedViews
		if _, err := to.ExecContext(ctx, "SET SESSION autocommit=1, sql_mode='STRICT_ALL_TABLES,NO_AUTO_VALUE_ON_ZERO,NO_ENGINE_SUBSTITUTION', time_zone='+00:00', foreign_key_checks=0, unique_checks=1"); err != nil {
			return err
		}
		// CREATE without IF NOT EXISTS is the authoritative race-free check.
		if _, err := to.ExecContext(ctx, "CREATE DATABASE "+quoteIdentifier(input.TargetDatabase)+" CHARACTER SET "+plan.charset+" COLLATE "+plan.collation); err != nil {
			var mysqlErr *driver.MySQLError
			if errors.As(err, &mysqlErr) && mysqlErr.Number == 1007 {
				return errors.New("目标数据库已存在，同步已停止")
			}
			return err
		}
		progress.Created = true
		progress.Phase = "created"
		if err := emit(progress); err != nil {
			return err
		}
		if _, err := to.ExecContext(ctx, "USE "+quoteIdentifier(input.TargetDatabase)); err != nil {
			return err
		}
		for _, table := range plan.tables {
			progress.Phase, progress.Table = "structure", table.name
			if err := emit(progress); err != nil {
				return err
			}
			if _, err := to.ExecContext(ctx, table.ddl); err != nil {
				return err
			}
			if !input.Data {
				progress.Completed++
				progress.Phase = "table_done"
				if err := emit(progress); err != nil {
					return err
				}
			}
		}
		if !input.Data {
			return nil
		}
		for _, table := range plan.tables {
			progress.Phase, progress.Table = "data", table.name
			if err := emit(progress); err != nil {
				return err
			}
			if err := copySyncRows(ctx, tx, to, input.SourceDatabase, table, func(rows int64) error {
				progress.Rows += rows
				return emit(progress)
			}); err != nil {
				return err
			}
			progress.Completed++
			progress.Phase = "table_done"
			if err := emit(progress); err != nil {
				return err
			}
		}
		return nil
	})
}

func (c *Client) withSyncConnections(ctx context.Context, source, target model.Connection, input model.DatabaseSyncRequest, run func(context.Context, *sql.Conn, *sql.Conn) error) error {
	ctx, sourceDB, releaseSource, err := c.openScopedRequest(ctx, source, input.SourceDatabase, true)
	if err != nil {
		return err
	}
	defer releaseSource()
	// Connect without a default target database since it must be absent.
	ctx, targetDB, lease, releaseTarget, err := c.openLeasedRequest(ctx, target, "", true)
	if err != nil {
		return err
	}
	defer releaseTarget()
	c.mu.Lock()
	lease.database = input.TargetDatabase
	if c.closing[sessionKey(target.ID, &lease.database)] {
		c.mu.Unlock()
		return errors.New("连接或数据库已关闭，请重新打开")
	}
	c.mu.Unlock()
	from, err := sourceDB.Conn(ctx)
	if err != nil {
		return fmt.Errorf("源连接：%w", err)
	}
	defer from.Close()
	to, err := targetDB.Conn(ctx)
	if err != nil {
		return fmt.Errorf("目标连接：%w", err)
	}
	defer to.Close()
	if err := CheckSyncServerType(ctx, from, source.Type); err != nil {
		return fmt.Errorf("源连接：%w", err)
	}
	if err := CheckSyncServerType(ctx, to, target.Type); err != nil {
		return fmt.Errorf("目标连接：%w", err)
	}
	return run(ctx, from, to)
}

// CheckSyncServerType distinguishes the engines which share the MySQL wire
// protocol before sync inspects or writes anything on that server.
func CheckSyncServerType(ctx context.Context, conn syncSource, expected string) error {
	var version string
	if err := conn.QueryRowContext(ctx, "SELECT VERSION()").Scan(&version); err != nil {
		return err
	}
	actual := model.TypeMySQL
	switch version := strings.ToLower(version); {
	case strings.Contains(version, "greptimedb"):
		actual = model.TypeGreptimeDB
	case strings.Contains(version, "mariadb"):
		actual = model.TypeMariaDB
	}
	if actual != model.NormalizeDatabaseType(expected) {
		return errors.New("服务器实际数据库类型与所选类型不符")
	}
	return nil
}

func configureSyncSource(ctx context.Context, from *sql.Conn) error {
	_, err := from.ExecContext(ctx, "SET SESSION autocommit=1, sql_quote_show_create=1, sql_mode='NO_ENGINE_SUBSTITUTION', time_zone='+00:00'")
	return err
}

func prepareDatabaseSync(ctx context.Context, from syncSource, to *sql.Conn, input model.DatabaseSyncRequest, engine string) (syncPlan, error) {
	var plan syncPlan
	var exists int
	if err := to.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM information_schema.SCHEMATA WHERE BINARY LOWER(SCHEMA_NAME)=BINARY LOWER(?))", input.TargetDatabase).Scan(&exists); err != nil {
		return plan, err
	}
	if exists != 0 {
		return plan, errors.New("目标数据库已存在，同步已停止")
	}
	if !input.CreateDatabase {
		return plan, errors.New("目标数据库不存在，请勾选允许新建目标库")
	}
	if err := from.QueryRowContext(ctx, "SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE BINARY SCHEMA_NAME = BINARY ?", input.SourceDatabase).Scan(&plan.charset, &plan.collation); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return plan, errors.New("源数据库不存在或不可访问")
		}
		return plan, err
	}
	if !syncDBOption.MatchString(plan.charset) || !syncDBOption.MatchString(plan.collation) {
		return plan, errors.New("源数据库字符集或排序规则无效")
	}
	var engineEnabled int
	var lowerCaseTableNames int
	var superReadOnly bool
	readOnly := "@@GLOBAL.super_read_only"
	collationCatalog := "information_schema.COLLATIONS"
	collationName := "COLLATION_NAME"
	if engine == model.TypeMariaDB {
		readOnly = "@@GLOBAL.read_only"
		collationCatalog = "information_schema.COLLATION_CHARACTER_SET_APPLICABILITY"
		collationName = "FULL_COLLATION_NAME"
	}
	if err := to.QueryRowContext(ctx, "SELECT (SELECT COUNT(*) FROM "+collationCatalog+" WHERE "+collationName+"=? AND CHARACTER_SET_NAME=?), (SELECT COUNT(*) FROM information_schema.ENGINES WHERE ENGINE='InnoDB' AND SUPPORT IN ('YES','DEFAULT')), @@lower_case_table_names, "+readOnly, plan.collation, plan.charset).Scan(&exists, &engineEnabled, &lowerCaseTableNames, &superReadOnly); err != nil {
		return plan, err
	}
	if superReadOnly {
		if engine == model.TypeMariaDB {
			return plan, errors.New("目标库处于只读模式，无法同步")
		}
		return plan, errors.New("目标 MySQL 处于强制只读模式，无法同步")
	}
	if exists != 1 || engineEnabled != 1 {
		return plan, errors.New("目标不支持源库排序规则或 InnoDB")
	}
	var crossSchemaReferences int
	if err := from.QueryRowContext(ctx, "SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE BINARY TABLE_SCHEMA = BINARY ? AND REFERENCED_TABLE_SCHEMA IS NOT NULL AND BINARY REFERENCED_TABLE_SCHEMA <> BINARY TABLE_SCHEMA", input.SourceDatabase).Scan(&crossSchemaReferences); err != nil {
		return plan, err
	}
	if crossSchemaReferences != 0 {
		return plan, errors.New("源库含跨库外键，无法安全同步")
	}
	rows, err := from.QueryContext(ctx, "SELECT TABLE_NAME, TABLE_TYPE, COALESCE(ENGINE,'') FROM information_schema.TABLES WHERE BINARY TABLE_SCHEMA=BINARY ? ORDER BY TABLE_NAME", input.SourceDatabase)
	if err != nil {
		return plan, err
	}
	defer rows.Close()
	names := map[string]bool{}
	for rows.Next() {
		var name, kind, engine string
		if err := rows.Scan(&name, &kind, &engine); err != nil {
			return plan, err
		}
		if kind == "VIEW" || (engine == model.TypeMariaDB && kind == "SEQUENCE") {
			if kind == "VIEW" {
				plan.SkippedViews++
			}
			continue
		}
		if kind != "BASE TABLE" || !strings.EqualFold(engine, "InnoDB") {
			return plan, fmt.Errorf("仅支持同步 InnoDB 表：%s", name)
		}
		key := name
		if lowerCaseTableNames != 0 {
			key = strings.ToLower(name)
		}
		if names[key] {
			return plan, errors.New("源表名称在目标库中存在大小写冲突")
		}
		names[key] = true
		plan.tables = append(plan.tables, syncTable{name: name})
	}
	if err := rows.Err(); err != nil {
		return plan, err
	}
	if err := rows.Close(); err != nil {
		return plan, err
	}
	plan.Tables = len(plan.tables)
	if plan.Tables == 0 {
		return plan, errors.New("源库没有可同步的 InnoDB 表")
	}
	for index := range plan.tables {
		table := &plan.tables[index]
		qualified := quoteIdentifier(input.SourceDatabase) + "." + quoteIdentifier(table.name)
		if input.Data {
			// Table reads retain metadata locks until the execution transaction ends.
			if err := probeSyncTable(ctx, from, "SELECT 1 FROM "+qualified+" LIMIT 0"); err != nil {
				return plan, err
			}
		}
		table.ddl, err = tableDDL(ctx, from, input.SourceDatabase, table.name)
		if err != nil {
			return plan, err
		}
		// Only accept an unqualified, explicitly InnoDB CREATE for this table.
		if !strings.HasPrefix(table.ddl, "CREATE TABLE "+quoteIdentifier(table.name)+" (") || !safeSyncDDL(table.ddl) || (engine == model.TypeMariaDB && strings.Contains(strings.ToUpper(table.ddl), "WITH SYSTEM VERSIONING")) {
			return plan, fmt.Errorf("表结构包含暂不支持的定义：%s", table.name)
		}
		if input.Data {
			table.columns, err = syncColumns(ctx, from, input.SourceDatabase, table.name)
			if err != nil {
				return plan, err
			}
			if err := probeSyncTable(ctx, from, "SELECT "+strings.Join(table.columns, ",")+" FROM "+qualified+" LIMIT 0"); err != nil {
				return plan, err
			}
		}
	}
	return plan, nil
}

func probeSyncTable(ctx context.Context, from syncSource, query string) error {
	rows, err := from.QueryContext(ctx, query)
	if err != nil {
		return err
	}
	return rows.Close()
}

func safeSyncDDL(ddl string) bool {
	// MySQL emits some table options in executable version comments. Unwrap those
	// comments and validate their contents with the same token rules.
	tokens := syncDDLTokens.FindAllString(ddl, -1)
	for i, token := range tokens {
		if (strings.HasPrefix(token, "/*!") && !safeSyncDDL(token[3:len(token)-2])) || (strings.HasPrefix(token, "/*M!") && !safeSyncDDL(token[4:len(token)-2])) {
			return false
		}
		switch strings.ToUpper(token) {
		case "TABLESPACE", "SECONDARY_ENGINE":
			return false
		case "DATA", "INDEX":
			if i+1 < len(tokens) && strings.EqualFold(tokens[i+1], "DIRECTORY") {
				return false
			}
		case "REFERENCES":
			if i+2 < len(tokens) && tokens[i+2] == "." {
				return false
			}
		}
	}
	return true
}

func syncColumns(ctx context.Context, conn syncSource, database, table string) ([]string, error) {
	rows, err := conn.QueryContext(ctx, "SELECT COLUMN_NAME, EXTRA, DATA_TYPE FROM information_schema.COLUMNS WHERE BINARY TABLE_SCHEMA=BINARY ? AND BINARY TABLE_NAME=BINARY ? ORDER BY ORDINAL_POSITION", database, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var columns []string
	for rows.Next() {
		var name, extra, dataType string
		if err := rows.Scan(&name, &extra, &dataType); err != nil {
			return nil, err
		}
		if strings.Contains(extra, "VIRTUAL GENERATED") || strings.Contains(extra, "STORED GENERATED") {
			continue
		}
		switch dataType {
		case "geometry", "point", "linestring", "polygon", "multipoint", "multilinestring", "multipolygon", "geometrycollection", "vector":
			return nil, fmt.Errorf("表含暂不支持同步的数据类型：%s.%s", table, name)
		}
		columns = append(columns, quoteIdentifier(name))
	}
	if len(columns) == 0 && rows.Err() == nil {
		return nil, fmt.Errorf("表没有可写入的普通列：%s", table)
	}
	return columns, rows.Err()
}
