package postgresql

import (
	"context"

	"sql-studio-backend/internal/model"
)

const foreignKeysSQL = `SELECT c.conname, target_schema.nspname, target.relname,
	c.confupdtype::text, c.confdeltype::text, source_column.attname, target_column.attname
	FROM pg_catalog.pg_constraint c
	JOIN pg_catalog.pg_class source ON source.oid = c.conrelid
	JOIN pg_catalog.pg_namespace source_schema ON source_schema.oid = source.relnamespace
	JOIN pg_catalog.pg_class target ON target.oid = c.confrelid
	JOIN pg_catalog.pg_namespace target_schema ON target_schema.oid = target.relnamespace
	CROSS JOIN LATERAL pg_catalog.generate_subscripts(c.conkey, 1) AS part(position)
	JOIN pg_catalog.pg_attribute source_column ON source_column.attrelid = source.oid AND source_column.attnum = c.conkey[part.position]
	JOIN pg_catalog.pg_attribute target_column ON target_column.attrelid = target.oid AND target_column.attnum = c.confkey[part.position]
	WHERE c.contype = 'f' AND source_schema.nspname = $1 AND source.relname = $2
	ORDER BY c.conname, c.oid, part.position`

func (c *Client) ForeignKeys(ctx context.Context, connection model.Connection, ref model.TableRef) ([]model.ForeignKey, error) {
	schema, table, err := relation(ref.Name)
	if err != nil {
		return nil, err
	}
	ctx, db, release, err := c.openRequest(ctx, connection, ref.Database)
	if err != nil {
		return nil, err
	}
	defer release()
	rows, err := db.QueryContext(ctx, foreignKeysSQL, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	keys := []model.ForeignKey{}
	for rows.Next() {
		var key model.ForeignKey
		var column model.ForeignKeyColumn
		if err := rows.Scan(&key.Name, &key.ReferencedSchema, &key.ReferencedTable, &key.OnUpdate, &key.OnDelete, &column.Name, &column.ReferencedName); err != nil {
			return nil, err
		}
		if len(keys) == 0 || keys[len(keys)-1].Name != key.Name {
			key.OnUpdate = foreignKeyAction(key.OnUpdate)
			key.OnDelete = foreignKeyAction(key.OnDelete)
			keys = append(keys, key)
		}
		keys[len(keys)-1].Columns = append(keys[len(keys)-1].Columns, column)
	}
	return keys, rows.Err()
}

func foreignKeyAction(code string) string {
	switch code {
	case "a":
		return "NO ACTION"
	case "r":
		return "RESTRICT"
	case "c":
		return "CASCADE"
	case "n":
		return "SET NULL"
	case "d":
		return "SET DEFAULT"
	default:
		return code
	}
}
