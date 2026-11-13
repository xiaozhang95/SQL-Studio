package webui

import (
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/gin-gonic/gin"
)

// Register mounts frontend files with Gin's static routes, separate from the API namespace.
func Register(router *gin.Engine, directory string) error {
	if directory == "" {
		directory = "../sql-studio-frontend/dist"
	}
	return registerFiles(router, os.DirFS(directory))
}

func registerFiles(router *gin.Engine, files fs.FS) error {
	web := router.Group("")
	web.Use(func(c *gin.Context) {
		if c.Request.URL.Path == "/" || c.Request.URL.Path == "/agent" || strings.HasSuffix(c.Request.URL.Path, ".html") {
			c.Header("Cache-Control", "no-cache")
		}
		c.Next()
	})
	root := onlyFiles{http.FS(files)}
	// Serving the directory lets Gin resolve index.html without an index redirect loop.
	web.StaticFileFS("/", "/", root)
	web.StaticFileFS("/agent", "/", root)
	web.StaticFileFS("/index.html", "/index.html", root)
	web.StaticFileFS("/swagger.html", "/swagger.html", root)
	web.StaticFileFS("/studio.svg", "/studio.svg", root)
	assets, err := fs.Sub(files, "assets")
	if err != nil {
		return err
	}
	web.StaticFS("/assets", onlyFiles{http.FS(assets)})
	entries, err := fs.ReadDir(files, ".")
	if errors.Is(err, fs.ErrNotExist) {
		return nil // Source development may start before its first frontend build.
	}
	if err != nil {
		return err
	}
	for _, entry := range entries {
		name := entry.Name()
		if name == "api" || name == "agent" || name == "assets" || name == "index.html" || name == "swagger.html" || name == "studio.svg" {
			continue
		}
		if entry.IsDir() {
			sub, err := fs.Sub(files, name)
			if err != nil {
				return err
			}
			web.StaticFS("/"+name, onlyFiles{http.FS(sub)})
		} else {
			web.StaticFileFS("/"+name, "/"+name, root)
		}
	}
	return nil
}

// onlyFiles preserves Gin StaticFS while rejecting directories without an index page.
type onlyFiles struct{ http.FileSystem }

func (s onlyFiles) Open(name string) (http.File, error) {
	file, err := s.FileSystem.Open(name)
	if err != nil {
		return nil, err
	}
	info, err := file.Stat()
	if err == nil && info.IsDir() {
		index, indexErr := s.FileSystem.Open(path.Join(name, "index.html"))
		if indexErr != nil {
			err = indexErr
		} else {
			indexInfo, statErr := index.Stat()
			_ = index.Close()
			if statErr != nil {
				err = statErr
			} else if indexInfo.IsDir() {
				err = fs.ErrNotExist
			}
		}
	}
	if err != nil {
		_ = file.Close()
		return nil, err
	}
	return file, nil
}
