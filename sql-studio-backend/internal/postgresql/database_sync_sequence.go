package postgresql

import (
	"context"
	"database/sql"
	"fmt"
)

type syncPGSequence struct {
	schema, name, column                    string
	identity                                bool
	typeSQL                                 string
	start, min, max, increment, cache, last int64
	cycle, called                           bool
}

func (s syncPGSequence) relation() string {
	return quoteIdentifier(s.schema) + "." + quoteIdentifier(s.name)
}

func (s syncPGSequence) options() string {
	return fmt.Sprintf(" AS %s INCREMENT BY %d MINVALUE %d MAXVALUE %d START WITH %d CACHE %d %s", s.typeSQL, s.increment, s.min, s.max, s.start, s.cache, map[bool]string{true: "CYCLE", false: "NO CYCLE"}[s.cycle])
}

func readSyncSequences(ctx context.Context, tx *sql.Tx, table string) ([]syncPGSequence, error) {
	rows, err := tx.QueryContext(ctx, `SELECT n.nspname,s.relname,a.attname,a.attidentity<>'',format_type(q.seqtypid,NULL),
		q.seqstart,q.seqmin,q.seqmax,q.seqincrement,q.seqcache,q.seqcycle
		FROM pg_depend d JOIN pg_class s ON s.oid=d.objid JOIN pg_namespace n ON n.oid=s.relnamespace
		JOIN pg_sequence q ON q.seqrelid=s.oid JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid
		WHERE d.refobjid=$1::regclass AND d.refclassid='pg_class'::regclass AND d.classid='pg_class'::regclass
		AND d.deptype IN ('a','i') AND s.relkind='S' AND NOT a.attisdropped`, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var sequences []syncPGSequence
	for rows.Next() {
		var sequence syncPGSequence
		if err = rows.Scan(&sequence.schema, &sequence.name, &sequence.column, &sequence.identity, &sequence.typeSQL,
			&sequence.start, &sequence.min, &sequence.max, &sequence.increment, &sequence.cache, &sequence.cycle); err != nil {
			return nil, err
		}
		switch sequence.typeSQL {
		case "smallint", "integer", "bigint":
		default:
			return nil, fmt.Errorf("序列类型不受支持：%s", sequence.relation())
		}
		sequences = append(sequences, sequence)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	for i := range sequences {
		sequence := &sequences[i]
		if err = tx.QueryRowContext(ctx, "SELECT last_value,is_called FROM "+sequence.relation()).Scan(&sequence.last, &sequence.called); err != nil {
			return nil, err
		}
	}
	return sequences, nil
}

func (table syncPGTable) create(ctx context.Context, to *sql.Conn) error {
	for _, sequence := range table.sequences {
		if sequence.identity {
			continue
		}
		if _, err := to.ExecContext(ctx, "CREATE SEQUENCE "+sequence.relation()+sequence.options()); err != nil {
			return err
		}
	}
	if err := execDefinition(ctx, to, table.ddl); err != nil {
		return err
	}
	for _, sequence := range table.sequences {
		query := "ALTER SEQUENCE " + sequence.relation() + " OWNED BY " + table.relation() + "." + quoteIdentifier(sequence.column)
		if sequence.identity {
			name, err := sequence.targetRelation(ctx, to, table)
			if err != nil {
				return err
			}
			query = "ALTER SEQUENCE " + name + sequence.options()
		}
		if _, err := to.ExecContext(ctx, query); err != nil {
			return err
		}
	}
	return nil
}

func (s syncPGSequence) targetRelation(ctx context.Context, to *sql.Conn, table syncPGTable) (string, error) {
	if !s.identity {
		return s.relation(), nil
	}
	var schema, name string
	err := to.QueryRowContext(ctx, `SELECT n.nspname,c.relname FROM pg_catalog.pg_class c
		JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
		WHERE c.oid=pg_catalog.pg_get_serial_sequence($1,$2)::regclass`, table.relation(), s.column).Scan(&schema, &name)
	return quoteIdentifier(schema) + "." + quoteIdentifier(name), err
}

func (s syncPGSequence) restoreValue(ctx context.Context, to *sql.Conn, table syncPGTable) error {
	name, err := s.targetRelation(ctx, to, table)
	if err != nil {
		return err
	}
	_, err = to.ExecContext(ctx, "SELECT pg_catalog.setval($1::regclass,$2,$3)", name, s.last, s.called)
	return err
}
