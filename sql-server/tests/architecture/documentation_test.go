package architecture_test

import (
	"os"
	"path/filepath"
	"testing"
)

// 每个实际基础包必须有同目录说明，避免分层后入口和职责失去索引。
func TestPackageReadmes(t *testing.T) {
	root := filepath.Join("..", "..", "internal")
	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if _, err := os.Stat(filepath.Join(root, entry.Name(), "README.md")); err != nil {
			t.Errorf("包 %s 缺少 README.md: %v", entry.Name(), err)
		}
	}
}
