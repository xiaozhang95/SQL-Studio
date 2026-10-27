package connection

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"sql-studio-backend/internal/model"
)

func migrationFixture(t *testing.T) (string, string) {
	t.Helper()
	source := t.TempDir()
	store, err := Open(source)
	if err != nil {
		t.Fatal(err)
	}
	saved, err := store.Save(model.Connection{Name: "fixture", Host: "fixture", Port: 3306, Username: "test", Password: "migration-secret"})
	if err != nil {
		t.Fatal(err)
	}
	return source, saved.ID
}

func TestMigrationPreservesOriginalKeyCiphertextAndState(t *testing.T) {
	source, id := migrationFixture(t)
	destination := t.TempDir()
	key, _ := os.ReadFile(filepath.Join(source, "master.key"))
	data, _ := os.ReadFile(filepath.Join(source, "connections.json"))
	state := filepath.Join(destination, "workspace.json")
	if err := os.WriteFile(state, []byte("layout fixture"), 0600); err != nil {
		t.Fatal(err)
	}
	// 模拟中断后目标已经拥有相同密钥，重试不得重新生成。
	if err := os.WriteFile(filepath.Join(destination, "master.key"), key, 0600); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(source, destination); err != nil {
		t.Fatal(err)
	}
	gotKey, _ := os.ReadFile(filepath.Join(destination, "master.key"))
	gotData, _ := os.ReadFile(filepath.Join(destination, "connections.json"))
	if !bytes.Equal(key, gotKey) || !bytes.Equal(data, gotData) {
		t.Fatal("migration rewrote key or ciphertext")
	}
	store, err := Open(destination)
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := store.Get(id)
	if err != nil || loaded.Password != "migration-secret" {
		t.Fatal("migrated password cannot decrypt", err)
	}
	if _, err := os.Stat(source); !os.IsNotExist(err) {
		t.Fatal("old data directory retained", err)
	}
	if content, _ := os.ReadFile(state); string(content) != "layout fixture" {
		t.Fatal("layout changed")
	}
	if err := Migrate(source, destination); err != nil {
		t.Fatal("repeat startup failed", err)
	}
}

func TestMigrationConflictAndMissingKeyNeverOverwrite(t *testing.T) {
	for _, conflict := range []string{"master.key", "connections.json", "missing-key", "invalid-ciphertext"} {
		t.Run(conflict, func(t *testing.T) {
			source, _ := migrationFixture(t)
			destination := t.TempDir()
			if conflict == "missing-key" {
				if err := os.Remove(filepath.Join(source, "master.key")); err != nil {
					t.Fatal(err)
				}
			} else if conflict == "invalid-ciphertext" {
				if err := os.WriteFile(filepath.Join(source, "connections.json"), []byte(`[{"id":"broken","password":"invalid"}]`), 0600); err != nil {
					t.Fatal(err)
				}
			} else {
				if err := os.WriteFile(filepath.Join(destination, conflict), []byte("existing target"), 0600); err != nil {
					t.Fatal(err)
				}
			}
			before, _ := os.ReadFile(filepath.Join(source, "connections.json"))
			if err := Migrate(source, destination); err == nil {
				t.Fatal("unsafe migration accepted")
			}
			after, _ := os.ReadFile(filepath.Join(source, "connections.json"))
			if !bytes.Equal(before, after) {
				t.Fatal("source changed")
			}
			if conflict == "master.key" || conflict == "connections.json" {
				if data, _ := os.ReadFile(filepath.Join(destination, conflict)); string(data) != "existing target" {
					t.Fatal("target overwritten")
				}
			}
		})
	}
}

func TestMigrationLeavesUnrelatedFilesAndCompletesKeyOnlyCleanup(t *testing.T) {
	source, _ := migrationFixture(t)
	destination := t.TempDir()
	for _, name := range []string{"master.key", "connections.json"} {
		data, _ := os.ReadFile(filepath.Join(source, name))
		if err := os.WriteFile(filepath.Join(destination, name), data, 0600); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Remove(filepath.Join(source, "connections.json")); err != nil {
		t.Fatal(err)
	}
	keep := filepath.Join(source, "keep.txt")
	if err := os.WriteFile(keep, []byte("keep"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(source, destination); err != nil {
		t.Fatal(err)
	}
	if data, _ := os.ReadFile(keep); string(data) != "keep" {
		t.Fatal("unrelated source file removed")
	}
	if _, err := os.Stat(filepath.Join(source, "master.key")); !os.IsNotExist(err) {
		t.Fatal("old key retained")
	}
}
