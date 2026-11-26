package oracle

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	driver "github.com/sijms/go-ora/v2"

	"sql-studio-backend/internal/model"
)

type syncTable struct {
	ref         model.TableRef
	destination string
	columns     []model.Column
	definition  string
	before      []string
	after       []string
	foreignKeys []string
}

func (c *Client) SyncDatabases(ctx context.Context, connection model.Connection) ([]string, error) {
	return c.Schemas(ctx, connection, "")
}

func (c *Client) CheckDatabaseSync(ctx context.Context, source, target model.Connection, request model.DatabaseSyncRequest) (model.DatabaseSyncPlan, error) {
	ctx, db, release, err := c.openRequest(ctx, target, "")
	if err != nil {
		return model.DatabaseSyncPlan{}, err
	}
	defer release()
	if err := validateSyncTarget(ctx, db, request); err != nil {
		return model.DatabaseSyncPlan{}, err
	}
	_, plan, err := c.prepareSync(ctx, source, request)
	return plan, err
}

func validateSyncTarget(ctx context.Context, target *requestDB, request model.DatabaseSyncRequest) error {
	if request.CreateDatabase {
		return errors.New("Oracle 同步需要先创建空的目标 Schema，并使用该 Schema 的账号连接")
	}
	var user, maintained string
	var objects, createTable int
	err := target.QueryRowContext(ctx, `SELECT SYS_CONTEXT('USERENV','SESSION_USER'),
  (SELECT ORACLE_MAINTAINED FROM ALL_USERS WHERE USERNAME=SYS_CONTEXT('USERENV','SESSION_USER')),
  (SELECT COUNT(*) FROM USER_OBJECTS WHERE OBJECT_NAME NOT LIKE 'BIN$%'),
  (SELECT COUNT(*) FROM SESSION_PRIVS WHERE PRIVILEGE='CREATE TABLE')
FROM DUAL`).Scan(&user, &maintained, &objects, &createTable)
	if err != nil {
		return err
	}
	if user != request.TargetDatabase || maintained != "N" {
		return errors.New("Oracle 目标 Schema 必须与目标连接的普通登录账号一致")
	}
	if createTable == 0 {
		return errors.New("Oracle 目标账号需要 CREATE TABLE 权限")
	}
	if objects != 0 {
		return errors.New("Oracle 目标 Schema 已有对象，同步已停止")
	}
	return nil
}

func (c *Client) prepareSync(ctx context.Context, source model.Connection, request model.DatabaseSyncRequest) ([]syncTable, model.DatabaseSyncPlan, error) {
	service, err := configuredService(source, "")
	if err != nil {
		return nil, model.DatabaseSyncPlan{}, err
	}
	objects, err := c.Tables(ctx, source, service)
	if err != nil {
		return nil, model.DatabaseSyncPlan{}, err
	}
	plan := model.DatabaseSyncPlan{ExistingTarget: true}
	tables := []syncTable{}
	available := make(map[string]bool)
	for _, object := range objects {
		owner, name, err := relation(object.Name)
		if err != nil {
			return nil, plan, err
		}
		if owner != request.SourceDatabase {
			continue
		}
		if object.Type == "VIEW" {
			plan.SkippedViews++
			continue
		}
		available[name] = true
		tables = append(tables, syncTable{
			ref:         model.TableRef{Database: service, Name: object.Name},
			destination: quoteIdentifier(request.TargetDatabase) + "." + quoteIdentifier(name),
		})
	}
	plan.Tables = len(tables)
	if plan.Tables == 0 {
		return nil, plan, errors.New("Oracle 源 Schema 中没有可同步的表")
	}
	for i := range tables {
		table := &tables[i]
		table.definition, err = c.DDL(ctx, source, table.ref)
		if err != nil {
			return nil, plan, err
		}
		table.columns, err = c.Columns(ctx, source, table.ref)
		if err != nil {
			return nil, plan, err
		}
		keys, err := c.ForeignKeys(ctx, source, table.ref)
		if err != nil {
			return nil, plan, err
		}
		for _, key := range keys {
			if key.ReferencedSchema != request.SourceDatabase || !available[key.ReferencedTable] {
				return nil, plan, fmt.Errorf("Oracle 表 %s 的外键引用同步范围以外的表", table.ref.Name)
			}
		}
		if err := table.prepare(request, len(keys)); err != nil {
			return nil, plan, fmt.Errorf("%s: %w", table.ref.Name, err)
		}
	}
	return tables, plan, nil
}

func (t *syncTable) prepare(request model.DatabaseSyncRequest, expectedForeignKeys int) error {
	statements, err := remapSchema(t.definition, request.SourceDatabase, request.TargetDatabase)
	if err != nil {
		return err
	}
	for _, statement := range statements {
		words := make([]string, len(statement.tokens))
		for i, token := range statement.tokens {
			words[i] = token.word
		}
		if containsWords(words, "CREATE", "GLOBAL") || containsWords(words, "CREATE", "PRIVATE") ||
			containsWords(words, "ORGANIZATION", "EXTERNAL") || containsWords(words, "ORGANIZATION", "INDEX") ||
			containsWords(words, "PARTITION", "BY") || containsWords(words, "DEFAULT", "ON", "NULL", "FOR", "INSERT", "AND", "UPDATE") {
			return errors.New("Oracle 同步仅支持普通表及其索引和约束")
		}
		for i, word := range words {
			if word == "@" || (word == "NEXTVAL" && i > 0 && words[i-1] == ".") {
				return errors.New("Oracle 同步需要源表的数据库链接及外部序列依赖由数据库工具处理")
			}
		}
		fk := containsWords(words, "FOREIGN", "KEY")
		if fk {
			if !containsWords(words[:min(2, len(words))], "ALTER", "TABLE") {
				return errors.New("Oracle 同步无法延后处理内联外键")
			}
			t.foreignKeys = append(t.foreignKeys, statement.text)
		} else {
			t.before = append(t.before, statement.text)
		}
	}
	if len(t.before) == 0 || expectedForeignKeys != len(t.foreignKeys) {
		return errors.New("Oracle 表结构无法用于同步")
	}
	if !request.Data {
		return nil
	}
	columns := t.columns[:0]
	for _, column := range t.columns {
		if strings.Contains(column.Extra, "VIRTUAL") {
			continue
		}
		if !syncBindable(column.Type) {
			return fmt.Errorf("字段 %s 的类型 %s 暂不支持 Oracle 数据同步", column.Name, column.Type)
		}
		columns = append(columns, column)
		if strings.Contains(column.Extra, "IDENTITY") {
			name := quoteIdentifier(column.Name)
			mode := "BY DEFAULT"
			if strings.Contains(column.Extra, "ON NULL") {
				mode = "BY DEFAULT ON NULL"
			}
			if strings.Contains(column.Extra, "ALWAYS") {
				mode = "ALWAYS"
				t.before = append(t.before, "ALTER TABLE "+t.destination+" MODIFY ("+name+" GENERATED BY DEFAULT AS IDENTITY)")
			}
			t.after = append(t.after, "ALTER TABLE "+t.destination+" MODIFY ("+name+" GENERATED "+mode+" AS IDENTITY (START WITH LIMIT VALUE))")
		}
	}
	t.columns = columns
	if len(columns) == 0 {
		return errors.New("Oracle 表没有可复制的列")
	}
	return nil
}

func containsWords(words []string, match ...string) bool {
	for i := 0; i+len(match) <= len(words); i++ {
		found := true
		for j, word := range match {
			found = found && words[i+j] == word
		}
		if found {
			return true
		}
	}
	return false
}

func remapSchema(ddl, owner, destination string) ([]batchStatement, error) {
	tokens, err := statementTokens(ddl)
	if err != nil {
		return nil, err
	}
	var statements []batchStatement
	var statement strings.Builder
	start, written := 0, 0
	for i, token := range tokens {
		if token.word == ";" {
			statement.WriteString(ddl[written:token.start])
			if i > start {
				statements = append(statements, batchStatement{text: strings.TrimSpace(statement.String()), tokens: tokens[start:i]})
			}
			start, written = i+1, token.end
			statement.Reset()
			continue
		}
		if i+1 < len(tokens) && tokens[i+1].word == "." &&
			(ddl[token.start:token.end] == quoteIdentifier(owner) || (owner[0] >= 'A' && owner[0] <= 'Z' && token.word == owner)) {
			statement.WriteString(ddl[written:token.start])
			statement.WriteString(quoteIdentifier(destination))
			written = token.end
		}
	}
	if start != len(tokens) {
		return nil, errors.New("Oracle 元数据未返回完整的 SQL 结构")
	}
	return statements, nil
}

func (c *Client) SyncDatabase(ctx context.Context, source, target model.Connection, request model.DatabaseSyncRequest, emit func(model.DatabaseSyncProgress) error) error {
	if err := emit(model.DatabaseSyncProgress{Phase: "checking", ExistingTarget: true}); err != nil {
		return err
	}
	ctx, targetDB, releaseTarget, err := c.openRequest(ctx, target, "")
	if err != nil {
		return err
	}
	defer releaseTarget()
	if err = validateSyncTarget(ctx, targetDB, request); err != nil {
		return err
	}
	tables, plan, err := c.prepareSync(ctx, source, request)
	if err != nil {
		return err
	}
	if err = validateSyncTarget(ctx, targetDB, request); err != nil {
		return err
	}
	var snapshot *sql.Tx
	if request.Data {
		snapshotCtx, sourceDB, releaseSource, err := c.openRequest(ctx, source, "")
		if err != nil {
			return err
		}
		defer releaseSource()
		snapshot, err = beginReadOnly(snapshotCtx, sourceDB)
		if err != nil {
			return err
		}
		defer snapshot.Rollback()
	}
	progress := model.DatabaseSyncProgress{Tables: plan.Tables, SkippedViews: plan.SkippedViews, ExistingTarget: true}
	for _, table := range tables {
		progress.Phase, progress.Table = "structure", table.ref.Name
		if err := emit(progress); err != nil {
			return err
		}
		if err := execSyncStatements(ctx, targetDB, table.before); err != nil {
			return err
		}
	}
	for _, table := range tables {
		progress.Table = table.ref.Name
		if request.Data {
			progress.Phase = "data"
			if err := emit(progress); err != nil {
				return err
			}
			count, err := table.copy(ctx, snapshot, targetDB)
			if err != nil {
				return err
			}
			progress.Rows += count
			if err := emit(progress); err != nil {
				return err
			}
		}
		if err := execSyncStatements(ctx, targetDB, table.after); err != nil {
			return err
		}
		latest, err := c.DDL(ctx, source, table.ref)
		if err != nil {
			return err
		}
		if latest != table.definition {
			return fmt.Errorf("Oracle 源表 %s 的结构在同步期间发生变化", table.ref.Name)
		}
	}
	for _, table := range tables {
		if err := execSyncStatements(ctx, targetDB, table.foreignKeys); err != nil {
			return err
		}
		progress.Phase, progress.Table = "table_done", table.ref.Name
		progress.Completed++
		if err := emit(progress); err != nil {
			return err
		}
	}
	return nil
}

func execSyncStatements(ctx context.Context, db *requestDB, statements []string) error {
	for _, statement := range statements {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	return nil
}

var bindableColumn = regexp.MustCompile(`^(?:NUMBER|FLOAT|CHAR|NCHAR|VARCHAR2|NVARCHAR2|RAW|TIMESTAMP)(?:\(| |$)`)

func syncBindable(kind string) bool {
	return bindableColumn.MatchString(kind) || kind == "DATE" || kind == "BLOB" || kind == "CLOB" || kind == "NCLOB" || kind == "BINARY_FLOAT" || kind == "BINARY_DOUBLE"
}

func (t syncTable) copy(ctx context.Context, source *sql.Tx, target *requestDB) (int64, error) {
	names, binds := make([]string, len(t.columns)), make([]string, len(t.columns))
	for i, column := range t.columns {
		names[i], binds[i] = quoteIdentifier(column.Name), ":"+strconv.Itoa(i+1)
	}
	projection := strings.Join(names, ", ")
	rows, err := source.QueryContext(ctx, "SELECT "+projection+" FROM "+t.ref.Name)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	tx, err := target.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	insert, err := tx.PrepareContext(ctx, "INSERT INTO "+t.destination+" ("+projection+") VALUES ("+strings.Join(binds, ", ")+")")
	if err != nil {
		return 0, err
	}
	defer insert.Close()
	values, pointers := make([]any, len(names)), make([]any, len(names))
	for i := range pointers {
		pointers[i] = &values[i]
	}
	var count int64
	for rows.Next() {
		if err := rows.Scan(pointers...); err != nil {
			return 0, err
		}
		bytes := 0
		for i, value := range values {
			switch v := value.(type) {
			case string:
				bytes += len(v)
			case []byte:
				bytes += len(v)
			}
			values[i], err = syncBind(t.columns[i].Type, value)
			if err != nil {
				return 0, err
			}
		}
		if bytes > resultByteLimit {
			return 0, errors.New("Oracle 同步单行数据超过 8 MiB")
		}
		if _, err := insert.ExecContext(ctx, values...); err != nil {
			return 0, err
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return count, nil
}

func syncBind(kind string, value any) (any, error) {
	switch v := value.(type) {
	case string:
		switch {
		case strings.HasPrefix(kind, "NUMBER"), strings.HasPrefix(kind, "FLOAT"):
			return driver.NewNumberFromString(v)
		case kind == "CLOB":
			return driver.Clob{String: v, Valid: true}, nil
		case kind == "NCLOB":
			return driver.NClob{String: v, Valid: true}, nil
		case strings.HasPrefix(kind, "NCHAR"), strings.HasPrefix(kind, "NVARCHAR2"):
			return driver.NVarChar(v), nil
		}
	case []byte:
		if kind == "BLOB" {
			return driver.Blob{Data: v, Valid: true}, nil
		}
	case time.Time:
		if strings.Contains(kind, "TIME ZONE") {
			return driver.TimeStampTZ(v), nil
		}
		if strings.HasPrefix(kind, "TIMESTAMP") {
			return driver.TimeStamp(v), nil
		}
	}
	return value, nil
}
