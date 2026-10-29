//go:build !embedded

package webui

import (
	"io/fs"
	"os"
)

func defaultFiles() fs.FS {
	return os.DirFS("../sql-studio-frontend/dist")
}
