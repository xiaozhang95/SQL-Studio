package postgresql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/stdlib"
	"sql-studio-backend/internal/model"
)

type syncPGTable struct {
	schema, name, ddl, columns string
	foreignKeys                []string
	sequences                  []syncPGSequence
}

func (t syncPGTable) relation() string {
	return quoteIdentifier(t.schema) + "." + quoteIdentifier(t.name)
}

type syncPGPlan struct {
	model.DatabaseSyncPlan
	encoding, collation, ctype string
	tables                     []syncPGTable
}

func (c *Client) CheckDatabaseSync(ctx context.Context, source, target model.Connection, input model.DatabaseSyncRequest) (plan model.DatabaseSyncPlan, err error) {
	err = c.withSyncPlan(ctx, source, target, input, func(_ context.Context, _ *sql.Conn, _ *sql.Conn, snapshot *syncPGPlan) error {
		plan = snapshot.DatabaseSyncPlan
		return nil
	})
	return plan, err
}

func (c *Client) SyncDatabase(ctx context.Context, source, target model.Connection, input model.DatabaseSyncRequest, emit func(model.DatabaseSyncProgress) error) error {
	progress := model.DatabaseSyncProgress{Phase: "checking"}
	if err := emit(progress); err != nil {
		return err
	}
	return c.withSyncPlan(ctx, source, target, input, func(ctx context.Context, from, maintenance *sql.Conn, plan *syncPGPlan) error {
		progress.Tables, progress.SkippedViews = plan.Tables, plan.SkippedViews
		_, err := maintenance.ExecContext(ctx, "CREATE DATABASE "+quoteIdentifier(input.TargetDatabase)+" TEMPLATE template0 ENCODING "+sqlString(plan.encoding)+" LC_COLLATE "+sqlString(plan.collation)+" LC_CTYPE "+sqlString(plan.ctype))
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && (pgErr.Code == "42P04" || pgErr.Code == "23505") {
				return errors.New("目标数据库已存在，同步已停止")
			}
			return err
		}
		progress.Created, progress.Phase = true, "created"
		if err := emit(progress); err != nil {
			return err
		}
		ctx, db, release, err := c.openScopedRequest(ctx, target, input.TargetDatabase, true)
		if err != nil {
			return err
		}
		defer release()
		to, err := db.Conn(ctx)
		if err != nil {
			return err
		}
		defer to.Close()
		for _, table := range plan.tables {
			progress.Table, progress.Phase = table.relation(), "structure"
			if err := emit(progress); err != nil {
				return err
			}
			if _, err := to.ExecContext(ctx, "CREATE SCHEMA IF NOT EXISTS "+quoteIdentifier(table.schema)); err != nil {
				return err
			}
			if err := table.create(ctx, to); err != nil {
				return err
			}
			if input.Data {
				progress.Phase = "data"
				if err := emit(progress); err != nil {
					return err
				}
				if err := copyPGTable(ctx, from, to, table, func(rows int64) error {
					progress.Rows += rows
					return emit(progress)
				}); err != nil {
					return err
				}
			}
			for _, sequence := range table.sequences {
				if err := sequence.restoreValue(ctx, to, table); err != nil {
					return err
				}
			}
			progress.Completed++
			progress.Phase = "table_done"
			if err := emit(progress); err != nil {
				return err
			}
		}
		for _, table := range plan.tables {
			for _, key := range table.foreignKeys {
				if _, err := to.ExecContext(ctx, "ALTER TABLE "+table.relation()+" ADD "+key); err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func (c *Client) withSyncPlan(ctx context.Context, source, target model.Connection, input model.DatabaseSyncRequest, run func(context.Context, *sql.Conn, *sql.Conn, *syncPGPlan) error) error {
	ctx, db, release, err := c.openScopedRequest(ctx, target, "", true)
	if err != nil {
		return err
	}
	defer release()
	maintenance, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	defer maintenance.Close()
	var exists, readOnly, canCreate bool
	if err = maintenance.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_database WHERE datname=$1), current_setting('transaction_read_only')='on', EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND (rolcreatedb OR rolsuper))`, input.TargetDatabase).Scan(&exists, &readOnly, &canCreate); err != nil {
		return err
	}
	switch {
	case exists:
		return errors.New("目标数据库已存在，同步已停止")
	case !input.CreateDatabase:
		return errors.New("目标数据库不存在，请勾选允许新建目标库")
	case readOnly:
		return errors.New("目标库处于只读模式，无法同步")
	case !canCreate:
		return errors.New("目标账号没有新建数据库权限")
	}
	ctx, sourceDB, closeSource, err := c.openScopedRequest(ctx, source, input.SourceDatabase, true)
	if err != nil {
		return err
	}
	defer closeSource()
	from, err := sourceDB.Conn(ctx)
	if err != nil {
		return err
	}
	defer from.Close()
	tx, err := from.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "SET LOCAL search_path TO pg_catalog"); err != nil {
		return err
	}
	plan, err := readPGSyncPlan(ctx, tx)
	if err != nil {
		return err
	}
	return run(ctx, from, maintenance, &plan)
}

func readPGSyncPlan(ctx context.Context, tx *sql.Tx) (plan syncPGPlan, err error) {
	var normalLocale bool
	if err = tx.QueryRowContext(ctx, `SELECT pg_encoding_to_char(encoding),datcollate,datctype,COALESCE(to_jsonb(d)->>'datlocprovider','c')='c' FROM pg_database d WHERE datname=current_database()`).Scan(&plan.encoding, &plan.collation, &plan.ctype, &normalLocale); err != nil {
		return
	}
	if !normalLocale {
		return plan, errors.New("源库使用暂不支持同步的排序规则提供程序")
	}
	rows, err := tx.QueryContext(ctx, `SELECT n.nspname,c.relname,c.relkind::text,
		c.relispartition OR c.relrowsecurity OR EXISTS(SELECT 1 FROM pg_inherits i WHERE i.inhrelid=c.oid OR i.inhparent=c.oid)
		OR EXISTS(SELECT 1 FROM pg_trigger tr WHERE tr.tgrelid=c.oid AND NOT tr.tgisinternal),
		has_table_privilege(c.oid,'SELECT')
		FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
		WHERE c.relkind IN ('r','p','f','v','m') AND n.nspname<>'information_schema' AND left(n.nspname,3)<>'pg_'
		AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
		ORDER BY n.nspname,c.relname`)
	if err != nil {
		return plan, err
	}
	defer rows.Close()
	for rows.Next() {
		var table syncPGTable
		var kind string
		var complex, readable bool
		if err = rows.Scan(&table.schema, &table.name, &kind, &complex, &readable); err != nil {
			return
		}
		if kind == "v" || kind == "m" {
			plan.SkippedViews++
			continue
		}
		if kind != "r" || complex || !readable {
			return plan, fmt.Errorf("表结构包含暂不支持的定义或没有读取权限：%s", table.relation())
		}
		plan.tables = append(plan.tables, table)
	}
	if err = rows.Err(); err != nil {
		return
	}
	rows.Close()
	plan.Tables = len(plan.tables)
	if plan.Tables == 0 {
		return plan, errors.New("源库没有可同步的普通表")
	}
	for i := range plan.tables {
		table := &plan.tables[i]
		if _, err = tx.ExecContext(ctx, "LOCK TABLE "+table.relation()+" IN ACCESS SHARE MODE"); err != nil {
			return
		}
		if err = table.loadDefinition(ctx, tx); err != nil {
			return
		}
	}
	return
}

func (t *syncPGTable) loadDefinition(ctx context.Context, tx *sql.Tx) error {
	var complex bool
	// Reject column types which need target-side objects outside this table plan.
	err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
		JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_type typ ON typ.oid=a.atttypid
		LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
		WHERE n.nspname=$1 AND c.relname=$2 AND a.attnum>0 AND NOT a.attisdropped
		AND (typ.typnamespace<>'pg_catalog'::regnamespace
		OR (d.oid IS NOT NULL AND EXISTS(SELECT 1 FROM pg_depend dep JOIN pg_class seq ON seq.oid=dep.refobjid
		  WHERE dep.classid='pg_attrdef'::regclass AND dep.objid=d.oid AND dep.refclassid='pg_class'::regclass AND seq.relkind='S'
		  AND NOT EXISTS(SELECT 1 FROM pg_depend owner WHERE owner.classid='pg_class'::regclass AND owner.objid=seq.oid
		    AND owner.refclassid='pg_class'::regclass AND owner.refobjid=c.oid AND owner.refobjsubid=a.attnum AND owner.deptype='a')))))`, t.schema, t.name).Scan(&complex)
	if err != nil {
		return err
	}
	if complex {
		return fmt.Errorf("表含外部序列或用户定义类型，暂不支持同步：%s", t.relation())
	}
	t.sequences, err = readSyncSequences(ctx, tx, t.relation())
	if err != nil {
		return err
	}
	t.ddl, err = tableDefinition(ctx, tx, t.schema, t.name, false)
	if err != nil {
		return err
	}
	if err = tx.QueryRowContext(ctx, `SELECT COALESCE(string_agg(quote_ident(a.attname),',' ORDER BY a.attnum),'')
		FROM pg_attribute a WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attgenerated=''`, t.relation()).Scan(&t.columns); err != nil {
		return err
	}
	if t.columns == "" {
		return fmt.Errorf("表没有可同步的普通列：%s", t.relation())
	}
	rows, err := tx.QueryContext(ctx, `SELECT 'CONSTRAINT '||quote_ident(conname)||' '||pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid=$1::regclass AND contype='f' ORDER BY conname`, t.relation())
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var key string
		if err = rows.Scan(&key); err != nil {
			return err
		}
		t.foreignKeys = append(t.foreignKeys, key)
	}
	return rows.Err()
}

func sqlString(value string) string { return "'" + strings.ReplaceAll(value, "'", "''") + "'" }

func execDefinition(ctx context.Context, target *sql.Conn, ddl string) error {
	// A definition from our catalog renderer contains CREATE TABLE and indexes.
	// Running them in a transaction leaves no half-created table if an index fails.
	return target.Raw(func(raw any) error {
		conn := raw.(*stdlib.Conn).Conn()
		tx, err := conn.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(context.WithoutCancel(ctx))
		if _, err = tx.Exec(ctx, ddl, pgx.QueryExecModeSimpleProtocol); err != nil {
			return err
		}
		return tx.Commit(ctx)
	})
}
