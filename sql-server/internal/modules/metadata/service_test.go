package metadata_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"sql-studio/internal/model"
	"sql-studio/internal/modules/metadata"
)

type repository struct{}

func (repository) Get(id string) (model.Connection, error) {
	return model.Connection{ID: id, Password: "secret-" + id}, nil
}

type database struct {
	check func(context.Context, model.Connection, string, string) error
}

func (d database) Databases(ctx context.Context, c model.Connection) ([]string, error) {
	return nil, d.check(ctx, c, "", "")
}
func (d database) Tables(ctx context.Context, c model.Connection, db string) ([]model.Table, error) {
	return nil, d.check(ctx, c, db, "")
}
func (d database) Columns(ctx context.Context, c model.Connection, ref model.TableRef) ([]model.Column, error) {
	return nil, d.check(ctx, c, ref.Database, ref.Name)
}
func (d database) DDL(ctx context.Context, c model.Connection, ref model.TableRef) (string, error) {
	return "", d.check(ctx, c, ref.Database, ref.Name)
}

// 两个连接使用同名对象，验证模块始终传递调用者的连接和对象范围。
func TestMetadataScopeAndCancellation(t *testing.T) {
	for _, id := range []string{"alpha", "beta"} {
		wantDB, wantTable := "", ""
		driver := database{check: func(ctx context.Context, c model.Connection, db, table string) error {
			if c.ID != id || c.Password != "secret-"+id || db != wantDB || table != wantTable {
				t.Fatal("metadata crossed connection or object scope")
			}
			deadline, ok := ctx.Deadline()
			if !ok || time.Until(deadline) > 10*time.Second {
				t.Fatal("metadata timeout missing")
			}
			return ctx.Err()
		}}
		svc := metadata.New(repository{}, driver)
		if _, err := svc.Databases(context.Background(), id); err != nil {
			t.Fatal(err)
		}
		wantDB = "shared"
		if _, err := svc.Tables(context.Background(), id, wantDB); err != nil {
			t.Fatal(err)
		}
		wantTable = "sample"
		if _, err := svc.Columns(context.Background(), id, wantDB, wantTable); err != nil {
			t.Fatal(err)
		}
		if _, err := svc.DDL(context.Background(), id, wantDB, wantTable); err != nil {
			t.Fatal(err)
		}
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		if _, err := svc.DDL(ctx, id, wantDB, wantTable); !errors.Is(err, context.Canceled) {
			t.Fatal("request cancellation was lost")
		}
	}
}
