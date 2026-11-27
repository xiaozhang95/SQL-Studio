package metadata_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/metadata"
)

type repository struct{ kind string }

func (r repository) Get(id string) (model.Connection, error) {
	return model.Connection{ID: id, Type: r.kind, Password: "secret-" + id}, nil
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
func (d database) Indexes(ctx context.Context, c model.Connection, ref model.TableRef) ([]model.Index, error) {
	return nil, d.check(ctx, c, ref.Database, ref.Name)
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
		if _, err := svc.Schemas(context.Background(), id, wantDB); err != nil {
			t.Fatal(err)
		}
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
		if _, err := svc.Indexes(context.Background(), id, wantDB, wantTable); err != nil {
			t.Fatal(err)
		}
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		if _, err := svc.Indexes(ctx, id, wantDB, wantTable); !errors.Is(err, context.Canceled) {
			t.Fatal("index request cancellation was lost")
		}
		if _, err := svc.DDL(ctx, id, wantDB, wantTable); !errors.Is(err, context.Canceled) {
			t.Fatal("request cancellation was lost")
		}
	}
}

func (d database) Schemas(ctx context.Context, c model.Connection, db string) ([]string, error) {
	return nil, d.check(ctx, c, db, "")
}

func TestOracleDDLUsesLongerDeadline(t *testing.T) {
	const table = `"TEST"."SAMPLE"`
	var deadline time.Time
	driver := database{check: func(ctx context.Context, _ model.Connection, _, _ string) error {
		deadline, _ = ctx.Deadline()
		return ctx.Err()
	}}
	svc := metadata.New(repository{kind: model.TypeOracle}, driver)
	ctx := context.Background()
	start := time.Now()
	if _, err := svc.DDL(ctx, "oracle", "FREEPDB1", table); err != nil {
		t.Fatal(err)
	}
	if deadline.Before(start.Add(30*time.Second)) || deadline.After(time.Now().Add(30*time.Second)) {
		t.Fatalf("Oracle DDL deadline = %v", deadline)
	}
	if _, err := svc.Columns(ctx, "oracle", "FREEPDB1", table); err != nil {
		t.Fatal(err)
	}
	if deadline.IsZero() || deadline.After(time.Now().Add(10*time.Second)) {
		t.Fatalf("Oracle column metadata deadline = %v", deadline)
	}

	parent, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	want, _ := parent.Deadline()
	if _, err := svc.DDL(parent, "oracle", "FREEPDB1", table); err != nil {
		t.Fatal(err)
	}
	if !deadline.Equal(want) {
		t.Fatalf("Oracle DDL did not inherit the earlier caller deadline")
	}
}
