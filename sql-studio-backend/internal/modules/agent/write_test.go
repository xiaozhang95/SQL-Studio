package agent

import (
	"context"
	"encoding/json"
	model "sql-studio-backend/internal/model/agent"
	"testing"
)

type writeFake struct {
	fakeDB
	writes int
}

func (d *writeFake) Write(context.Context, model.Target, string) (json.RawMessage, error) {
	d.writes++
	return json.RawMessage(`{"affectedRows":1}`), nil
}
func TestWriteGrammarAndPermission(t *testing.T) {
	for _, sql := range []string{"CREATE TABLE demo (id INT)", "ALTER TABLE demo ADD COLUMN name VARCHAR(20)", "UPDATE t SET n=n+1 WHERE id>1", "INSERT INTO t (name,n) VALUES ('a',1)", "UPDATE t SET name='a' WHERE id=1", `UPDATE "items" SET "name"='a' WHERE "id"=1`, "INSERT INTO t (name) VALUES ('DELETE FROM t')"} {
		if err := ValidateWriteSQL(sql); err != nil {
			t.Fatal(sql, err)
		}
	}
	for _, sql := range []string{"ALTER TABLE t DROP COLUMN name", "CREATE FUNCTION x() RETURNS void AS $DELETE FROM t$ LANGUAGE SQL", "CALL cleanup()", "INSERT INTO t(n) VALUES(1);DELETE FROM t", "DELETE FROM t", "TRUNCATE t", "DROP TABLE t", "REPLACE INTO t VALUES(1)", "UPDATE t SET n=1 WHERE id=1;DELETE FROM t", "/*! DELETE FROM t */", "UPDATE t SET name='a\\' OR 1=1 WHERE id=1"} {
		if ValidateWriteSQL(sql) == nil {
			t.Fatal("accepted", sql)
		}
	}
	db := &writeFake{}
	s := New(nil, db)
	state := toolState{target: model.Target{ConnectionID: "a", Database: "demo"}}
	c := call("execute_write", `{"sql":"UPDATE t SET n=1 WHERE id=1"}`).ToolCalls[0]
	if _, err := s.execute(context.Background(), &state, c); err == nil || db.writes != 0 {
		t.Fatal("readonly bypass")
	}
	state.allowWrite = true
	if _, err := s.execute(context.Background(), &state, c, func(e model.Event) error {
		var v struct {
			ID string `json:"approvalId"`
		}
		json.Unmarshal(e.Result, &v)
		return s.ConfirmWrite(v.ID, true)
	}); err != nil || db.writes != 1 {
		t.Fatal(err)
	}
	c.Function.Arguments = `{"sql":"DELETE FROM t"}`
	if _, err := s.execute(context.Background(), &state, c); err == nil || db.writes != 1 {
		t.Fatal("delete executed")
	}
}

func TestWriteWaitsForExplicitDecision(t *testing.T) {
	for _, allow := range []bool{false, true} {
		db := &writeFake{}
		s := New(nil, db)
		state := toolState{allowWrite: true, target: model.Target{ConnectionID: "a", Database: "demo"}}
		pending := make(chan string, 1)
		done := make(chan error, 1)
		c := call("execute_write", `{"sql":"UPDATE users SET name='test' WHERE id=1"}`).ToolCalls[0]
		go func() {
			_, err := s.execute(context.Background(), &state, c, func(e model.Event) error {
				var v struct {
					ID       string `json:"approvalId"`
					Database string `json:"database"`
					SQL      string `json:"sql"`
				}
				if err := json.Unmarshal(e.Result, &v); err != nil {
					return err
				}
				if v.Database != "demo" || v.SQL == "" {
					return context.Canceled
				}
				pending <- v.ID
				return nil
			})
			done <- err
		}()
		id := <-pending
		select {
		case <-done:
			t.Fatal("write did not wait")
		default:
		}
		if db.writes != 0 {
			t.Fatal("write before confirmation")
		}
		if err := s.ConfirmWrite(id, allow); err != nil {
			t.Fatal(err)
		}
		err := <-done
		if allow && (err != nil || db.writes != 1) {
			t.Fatal(err, db.writes)
		}
		if !allow && (err == nil || db.writes != 0) {
			t.Fatal("cancel executed", err)
		}
		if s.ConfirmWrite(id, true) == nil {
			t.Fatal("approval replay")
		}
	}
}
func TestPendingWriteCancellationNeverExecutes(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	db := &writeFake{}
	s := New(nil, db)
	state := toolState{allowWrite: true, target: model.Target{ConnectionID: "a", Database: "demo"}}
	id := ""
	_, err := s.execute(ctx, &state, call("execute_write", `{"sql":"INSERT INTO t(n) VALUES(1)"}`).ToolCalls[0], func(e model.Event) error {
		var v struct {
			ID string `json:"approvalId"`
		}
		json.Unmarshal(e.Result, &v)
		id = v.ID
		cancel()
		return nil
	})
	if err == nil || db.writes != 0 || s.ConfirmWrite(id, true) == nil {
		t.Fatal("cancelled write remained executable")
	}
}
