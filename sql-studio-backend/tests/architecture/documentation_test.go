package architecture_test

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 每个实际基础包必须有同目录说明，避免分层后入口和职责失去索引。
func TestPackageReadmes(t *testing.T) {
	root := filepath.Join("..", "..", "internal")
	checked := map[string]bool{}
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}
		dir := filepath.Dir(path)
		if checked[dir] {
			return nil
		}
		checked[dir] = true
		for _, name := range []string{"README.md", "doc.go"} {
			if _, err := os.Stat(filepath.Join(dir, name)); err != nil {
				t.Errorf("包 %s 缺少 %s: %v", dir, name, err)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
