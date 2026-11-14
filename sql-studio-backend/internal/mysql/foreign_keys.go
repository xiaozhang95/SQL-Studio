package mysql

import (
	"context"

	"sql-studio-backend/internal/model"
)

const foreignKeysSQL = `SELECT k.CONSTRAINT_NAME, k.REFERENCED_TABLE_SCHEMA, k.REFERENCED_TABLE_NAME,
	r.UPDATE_RULE, r.DELETE_RULE, k.COLUMN_NAME, k.REFERENCED_COLUMN_NAME
	FROM information_schema.KEY_COLUMN_USAGE k
	JOIN information_schema.REFERENTIAL_CONSTRAINTS r
		ON CAST(k.CONSTRAINT_SCHEMA AS BINARY) = CAST(r.CONSTRAINT_SCHEMA AS BINARY)
		AND CAST(k.TABLE_NAME AS BINARY) = CAST(r.TABLE_NAME AS BINARY)
		AND CAST(k.CONSTRAINT_NAME AS BINARY) = CAST(r.CONSTRAINT_NAME AS BINARY)
	WHERE k.TABLE_SCHEMA = ? AND k.TABLE_NAME = ?
		AND CAST(k.TABLE_SCHEMA AS BINARY) = CAST(? AS BINARY)
		AND CAST(k.TABLE_NAME AS BINARY) = CAST(? AS BINARY)
		AND k.REFERENCED_TABLE_NAME IS NOT NULL
	ORDER BY CAST(k.CONSTRAINT_NAME AS BINARY), k.ORDINAL_POSITION`

func (c *Client) ForeignKeys(ctx context.Context, connection model.Connection, ref model.TableRef) ([]model.ForeignKey, error) {
	ctx, db, release, err := c.openRequest(ctx, connection, ref.Database)
	if err != nil {
		return nil, err
	}
	defer release()
	rows, err := db.QueryContext(ctx, foreignKeysSQL, ref.Database, ref.Name, ref.Database, ref.Name)
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
			keys = append(keys, key)
		}
		keys[len(keys)-1].Columns = append(keys[len(keys)-1].Columns, column)
	}
	return keys, rows.Err()
}
