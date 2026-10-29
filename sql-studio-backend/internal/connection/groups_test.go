package connection

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"sql-studio-backend/internal/model"
)

func TestGroupsPersistRenameAndMoveWithoutTouchingCredentials(t *testing.T) {
	dir := t.TempDir()
	store, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	saved, err := store.Save(model.Connection{Name: "connection", Group: "开发", Host: "host", Port: 3307, Username: "root", Password: "group-test-secret", Type: model.TypeMariaDB, TLS: true})
	if err != nil {
		t.Fatal(err)
	}
	original := store.items[0]
	if _, err = store.CreateGroup(" 空分组 "); err != nil {
		t.Fatal(err)
	}
	store, err = Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !containsGroup(store.Groups(), "空分组") {
		t.Fatal("empty group was lost on reload")
	}
	if _, err = store.RenameGroup("开发", "测试"); err != nil {
		t.Fatal(err)
	}
	expected := original
	expected.Group = "测试"
	if !reflect.DeepEqual(store.items[0], expected) {
		t.Fatal("rename changed connection metadata or ciphertext")
	}
	if containsGroup(store.Groups(), "开发") {
		t.Fatal("old group survived rename")
	}
	moved, err := store.MoveGroup(saved.ID, "空分组")
	if err != nil {
		t.Fatal(err)
	}
	if moved.Password != "" || !moved.HasPassword || moved.ID != saved.ID || moved.Group != "空分组" {
		t.Fatal("invalid move response")
	}
	expected.Group = "空分组"
	if !reflect.DeepEqual(store.items[0], expected) {
		t.Fatal("move changed metadata or ciphertext")
	}
	if !containsGroup(store.Groups(), "测试") {
		t.Fatal("moving last member deleted group")
	}
	if _, err = store.RenameGroup("测试", "已改名空组"); err != nil {
		t.Fatal(err)
	}
	store, err = Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !containsGroup(store.Groups(), "已改名空组") || containsGroup(store.Groups(), "测试") {
		t.Fatal("empty group rename not persisted")
	}
	credential, err := store.Get(saved.ID)
	if err != nil || credential.Password != "group-test-secret" {
		t.Fatal("credentials no longer decrypt")
	}
	if err = store.Delete(saved.ID); err != nil {
		t.Fatal(err)
	}
	if !containsGroup(store.Groups(), "空分组") {
		t.Fatal("deleting last member deleted group")
	}
}

func TestGroupsRejectInvalidOperationsAndFailedWriteKeepsMemory(t *testing.T) {
	store, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err = store.CreateGroup("first"); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"", "  ", "bad\nname", "first", model.DefaultConnectionGroup} {
		if _, err = store.CreateGroup(name); err == nil {
			t.Fatalf("accepted invalid/duplicate group %q", name)
		}
	}
	if _, err = store.RenameGroup(model.DefaultConnectionGroup, "other"); err == nil {
		t.Fatal("renamed reserved group")
	}
	if _, err = store.RenameGroup("first", model.DefaultConnectionGroup); err == nil {
		t.Fatal("duplicate rename accepted")
	}
	if _, err = store.RenameGroup("missing", "other"); err == nil {
		t.Fatal("missing rename accepted")
	}
	if _, err = store.MoveGroup("missing", "first"); !os.IsNotExist(err) {
		t.Fatal("missing connection accepted")
	}
	before := store.Groups()
	store.path = filepath.Join(t.TempDir(), "missing", "connections.json")
	if _, err = store.RenameGroup("first", "failed"); err == nil {
		t.Fatal("write unexpectedly succeeded")
	}
	if !reflect.DeepEqual(store.Groups(), before) {
		t.Fatal("failed write changed memory")
	}
}

func TestExistingConnectionArrayLoadsWithoutRewritingCiphertext(t *testing.T) {
	dir := t.TempDir()
	store, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = store.Save(model.Connection{Name: "existing", Group: "existing-group", Password: "secret"}); err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(store.items)
	if err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(store.path, data, 0600); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(reopened.items, store.items) || !containsGroup(reopened.Groups(), "existing-group") {
		t.Fatal("existing connections changed")
	}
}

func TestEmptyStoreGroupsSurviveReopenAndIncompleteDocumentIsRejected(t *testing.T) {
	dir := t.TempDir()
	store, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = store.CreateGroup("empty"); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(dir)
	if err != nil || len(reopened.List()) != 0 || !containsGroup(reopened.Groups(), "empty") {
		t.Fatal("empty store lost independent groups")
	}
	if err = os.WriteFile(store.path, []byte(`{}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = Open(dir); err == nil {
		t.Fatal("incomplete document accepted for overwrite")
	}
}

func TestDeleteGroupMovesMembersAtomicallyAndPreservesCredentials(t *testing.T) {
	dir := t.TempDir()
	store, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	member, err := store.Save(model.Connection{Name: "one", Group: "删除组", Password: "delete-group-secret", Type: model.TypePostgreSQL, Database: "maintenance", Host: "host", Port: 5432, TLS: true})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = store.Save(model.Connection{Name: "other", Group: "其他组", Password: "other-secret"}); err != nil {
		t.Fatal(err)
	}
	before := append([]model.Connection{}, store.items...)
	if _, err = store.CreateGroup("空组"); err != nil {
		t.Fatal(err)
	}
	if _, err = store.DeleteGroup(" 空组 "); err != nil {
		t.Fatal(err)
	}
	if containsGroup(store.Groups(), "空组") {
		t.Fatal("empty group survived")
	}
	if _, err = store.DeleteGroup("删除组"); err != nil {
		t.Fatal(err)
	}
	if containsGroup(store.Groups(), "删除组") {
		t.Fatal("deleted group survived")
	}
	before[0].Group = model.DefaultConnectionGroup
	if !reflect.DeepEqual(store.items, before) {
		t.Fatal("delete modified connection fields or ciphertext")
	}
	reopened, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := reopened.Get(member.ID)
	if err != nil || raw.Group != model.DefaultConnectionGroup || raw.Password != "delete-group-secret" || containsGroup(reopened.Groups(), "删除组") {
		t.Fatal("group deletion not persisted", err)
	}
	if _, err = reopened.DeleteGroup(model.DefaultConnectionGroup); err == nil {
		t.Fatal("default group deleted")
	}
	if _, err = reopened.DeleteGroup("missing"); !os.IsNotExist(err) {
		t.Fatal("missing group accepted", err)
	}
	// Persistence failures must preserve both the folder and all member assignments.
	snapshot := append([]model.Connection{}, reopened.items...)
	groups := reopened.Groups()
	reopened.path = filepath.Join(t.TempDir(), "missing", "connections.json")
	if _, err = reopened.DeleteGroup("其他组"); err == nil {
		t.Fatal("write failure ignored")
	}
	if !reflect.DeepEqual(reopened.items, snapshot) || !reflect.DeepEqual(reopened.Groups(), groups) {
		t.Fatal("failed delete changed memory")
	}
}
