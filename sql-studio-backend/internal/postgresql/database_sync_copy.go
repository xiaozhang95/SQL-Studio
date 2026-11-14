package postgresql

import (
	"context"
	"database/sql"
	"io"

	"github.com/jackc/pgx/v5/stdlib"
)

// Text COPY preserves PostgreSQL types without decoding through Go. The pipe
// bounds memory and cancellation of either side unblocks the other.
func copyPGTable(ctx context.Context, from, to *sql.Conn, table syncPGTable, copied func(int64) error) error {
	scope := table.relation() + " (" + table.columns + ")"
	reader, writer := io.Pipe()
	defer reader.Close()
	done := make(chan error, 1)
	go func() {
		err := from.Raw(func(raw any) error {
			_, err := raw.(*stdlib.Conn).Conn().PgConn().CopyTo(ctx, writer, "COPY "+scope+" TO STDOUT")
			return err
		})
		writer.CloseWithError(err)
		done <- err
	}()
	var count int64
	err := to.Raw(func(raw any) error {
		command, err := raw.(*stdlib.Conn).Conn().PgConn().CopyFrom(ctx, reader, "COPY "+scope+" FROM STDIN")
		count = command.RowsAffected()
		return err
	})
	reader.CloseWithError(err)
	sourceErr := <-done
	if err != nil {
		return err
	}
	if sourceErr != nil {
		return sourceErr
	}
	return copied(count)
}
