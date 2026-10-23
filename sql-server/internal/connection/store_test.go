package connection

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"sqldesk/internal/model"
)

func TestEncryptedStoreRoundTrip(t *testing.T) {
	dir := t.TempDir()
	store, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	saved, err := store.Save(model.Connection{Name: "test", Host: "localhost", Port: 3306, Username: "root", Password: "test-secret-123"})
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(dir, "connections.json"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(data, []byte("test-secret-123")) {
		t.Fatal("password stored in plaintext")
	}
	public, _ := json.Marshal(store.List())
	if bytes.Contains(public, []byte("password\"")) {
		t.Fatal("password field leaked")
	}
	saved.Name = "renamed"
	if _, err = store.Save(saved); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := reopened.Get(saved.ID)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Password != "test-secret-123" || loaded.Name != "renamed" {
		t.Fatal("update/reload lost credentials")
	}
	if loaded.Type != model.TypeMySQL || reopened.List()[0].Type != model.TypeMySQL {
		t.Fatal("legacy connection did not default to MySQL")
	}
	reopened.items[0].Password = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	if _, err = reopened.Get(saved.ID); err == nil {
		t.Fatal("tampered ciphertext accepted")
	}
	if err = store.Delete(saved.ID); err != nil {
		t.Fatal(err)
	}
	if len(store.List()) != 0 {
		t.Fatal("connection not removed")
	}
}

func TestMissingMasterKeyDoesNotOverwriteCredentials(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "connections.json"), []byte("[]"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(dir); err == nil {
		t.Fatal("missing master key should fail")
	}
}
