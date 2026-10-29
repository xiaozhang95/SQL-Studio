//go:build embedded

package webui

import (
	"embed"
	"io/fs"
)

// build.ps1 replaces this generated directory with the latest frontend build before Go compilation.
//
//go:embed all:dist
var assets embed.FS

func defaultFiles() fs.FS {
	files, err := fs.Sub(assets, "dist")
	if err != nil {
		panic(err) // The compile-time embed directive guarantees the directory exists.
	}
	return files
}
