package oracle

import (
	"context"
	"database/sql"
	"strings"

	"sql-studio-backend/internal/model"
)

const prepareDDL = `BEGIN
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'SQLTERMINATOR', TRUE);
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'SEGMENT_ATTRIBUTES', FALSE);
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'CONSTRAINTS_AS_ALTER', TRUE);
END;`

func (c *Client) DDL(ctx context.Context, connection model.Connection, ref model.TableRef) (string, error) {
	owner, name, err := relation(ref.Name)
	if err != nil {
		return "", err
	}
	ctx, db, release, err := c.openRequest(ctx, connection, ref.Database)
	if err != nil {
		return "", err
	}
	defer release()
	conn, err := db.Conn(ctx)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	var kind string
	var comment sql.NullString
	err = conn.QueryRowContext(ctx, "SELECT TABLE_TYPE, COMMENTS FROM ALL_TAB_COMMENTS WHERE OWNER=:1 AND TABLE_NAME=:2 AND TABLE_TYPE IN ('TABLE','VIEW')", owner, name).Scan(&kind, &comment)
	if err != nil {
		return "", err
	}
	if _, err := conn.ExecContext(ctx, prepareDDL); err != nil {
		return "", err
	}
	var ddl string
	if err := conn.QueryRowContext(ctx, "SELECT DBMS_METADATA.GET_DDL(:1, :2, :3) FROM DUAL", kind, name, owner).Scan(&ddl); err != nil {
		return "", err
	}
	statements := []string{strings.TrimSpace(ddl)}
	if kind == "TABLE" {
		extra, err := metadataRows(ctx, conn, `SELECT n.OWNER, n.INDEX_NAME FROM ALL_INDEXES n
WHERE n.TABLE_OWNER=:1 AND n.TABLE_NAME=:2 AND n.GENERATED='N'
AND n.INDEX_TYPE NOT IN ('LOB','IOT - TOP')
AND NOT EXISTS (
  SELECT 1 FROM ALL_CONSTRAINTS c WHERE c.INDEX_OWNER=n.OWNER AND c.INDEX_NAME=n.INDEX_NAME AND c.CONSTRAINT_TYPE IN ('P','U')
) ORDER BY n.OWNER, n.INDEX_NAME`, func(rows *sql.Rows) ([2]string, error) {
			var key [2]string
			err := rows.Scan(&key[0], &key[1])
			return key, err
		}, owner, name)
		if err != nil {
			return "", err
		}
		for _, index := range extra {
			var text string
			if err := conn.QueryRowContext(ctx, "SELECT DBMS_METADATA.GET_DDL('INDEX', :1, :2) FROM DUAL", index[1], index[0]).Scan(&text); err != nil {
				return "", err
			}
			statements = append(statements, strings.TrimSpace(text))
		}
	}
	if comment.Valid {
		statements = append(statements, "COMMENT ON TABLE "+ref.Name+" IS "+quoteLiteral(comment.String)+";")
	}
	comments, err := metadataRows(ctx, conn, `SELECT COLUMN_NAME, COMMENTS FROM ALL_COL_COMMENTS
WHERE OWNER=:1 AND TABLE_NAME=:2 AND COMMENTS IS NOT NULL ORDER BY COLUMN_NAME`, func(rows *sql.Rows) (string, error) {
		var column, comment string
		err := rows.Scan(&column, &comment)
		return "COMMENT ON COLUMN " + ref.Name + "." + quoteIdentifier(column) + " IS " + quoteLiteral(comment) + ";", err
	}, owner, name)
	if err != nil {
		return "", err
	}
	statements = append(statements, comments...)
	return strings.Join(statements, "\n\n"), nil
}

func quoteLiteral(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "''") + "'"
}
