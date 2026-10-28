package architecture_test

import (
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// 将依赖方向纳入回归检查，防止后续新增接口又直接耦合数据库或文件存储。
func TestInternalDependencyDirection(t *testing.T) {
	allowed := map[string]map[string]bool{
		"app":        {"modules/ai": true, "deepseek": true, "statefile": true, "modules/settings": true, "config": true, "connection": true, "httpapi": true, "mysql": true, "postgresql": true, "database": true, "model": true, "modules/connections": true, "modules/metadata": true, "modules/query": true},
		"postgresql": {"model": true, "rowstream": true}, "database": {"model": true}, "config": {"model": true}, "connection": {"model": true}, "mysql": {"model": true, "rowstream": true}, "rowstream": {"model": true},
		"httpapi":    {"modules/ai": true, "modules/settings": true, "modules/connections": true, "modules/metadata": true, "modules/query": true, "model": true},
		"modules/ai": {"model": true}, "deepseek": {"model": true},
		"statefile": {"model": true}, "modules/settings": {"model": true}, "modules/connections": {"model": true}, "modules/metadata": {"model": true}, "modules/query": {"model": true}, "model": {},
	}
	root, err := filepath.Abs("../../internal")
	if err != nil {
		t.Fatal(err)
	}
	err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		layer := filepath.ToSlash(filepath.Dir(relative))
		dependencies, ok := allowed[layer]
		if !ok {
			t.Errorf("新包 %s 需要先声明依赖边界", layer)
			return nil
		}
		file, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.ImportsOnly)
		if err != nil {
			return err
		}
		for _, spec := range file.Imports {
			dependency, err := strconv.Unquote(spec.Path.Value)
			if err != nil {
				return err
			}
			if strings.HasPrefix(dependency, "sql-studio-backend/internal/") {
				target := strings.TrimPrefix(dependency, "sql-studio-backend/internal/")
				if !dependencies[target] {
					t.Errorf("%s 不得依赖 %s", relative, dependency)
				}
			}
			if dependency == "net/http" && layer != "httpapi" && layer != "app" && layer != "deepseek" {
				t.Errorf("%s 不得依赖 HTTP 传输层", relative)
			}
			if dependency == "database/sql" && layer != "mysql" && layer != "postgresql" && layer != "rowstream" {
				t.Errorf("%s 不得直接依赖 SQL 驱动", relative)
			}
			if (dependency == "os" || strings.HasPrefix(dependency, "os/")) && (strings.HasPrefix(layer, "modules/") || layer == "httpapi") {
				t.Errorf("%s 不得直接读取系统配置或文件", relative)
			}
			if strings.HasPrefix(dependency, "github.com/gin-gonic/") && layer != "httpapi" && layer != "app" {
				t.Errorf("%s 不得依赖 Gin 框架", relative)
			}
			if strings.HasPrefix(dependency, "github.com/go-sql-driver/") && layer != "mysql" {
				t.Errorf("%s 不得跨引擎依赖 MySQL 驱动", relative)
			}
			if strings.HasPrefix(dependency, "github.com/jackc/") && layer != "postgresql" {
				t.Errorf("%s 不得跨引擎依赖 PostgreSQL 驱动", relative)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
