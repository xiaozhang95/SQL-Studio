package webui

import (
	"io/fs"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/gin-gonic/gin"
)

func testRouter(t *testing.T, files fs.FS) *gin.Engine {
	t.Helper()
	router := gin.New()
	router.HandleMethodNotAllowed = true
	router.NoRoute(func(c *gin.Context) { c.String(404, "404 page not found") })
	if err := registerFiles(router, files); err != nil {
		t.Fatal(err)
	}
	return router
}

func TestStaticFilesAndBoundaries(t *testing.T) {
	handler := testRouter(t, fstest.MapFS{
		"index.html":         {Data: []byte("<!doctype html><title>SQL Studio</title>")},
		"swagger.html":       {Data: []byte("<!doctype html><title>Swagger</title>")},
		"assets/app-123.js":  {Data: []byte("console.log('app')")},
		"assets/app-123.css": {Data: []byte("body { color: red }")},
		"studio.svg":         {Data: []byte(`<svg xmlns="http://www.w3.org/2000/svg"/>`)},
	})
	for _, tc := range []struct {
		method, path string
		status       int
		contentType  string
	}{
		{"GET", "/", 200, "text/html"},
		{"HEAD", "/", 200, "text/html"},
		{"GET", "/agent", 200, "text/html"},
		{"HEAD", "/agent", 200, "text/html"},
		{"GET", "/monitor?connection=fixture&database=fixture", 200, "text/html"},
		{"HEAD", "/monitor", 200, "text/html"},
		{"GET", "/sync", 200, "text/html"},
		{"HEAD", "/sync", 200, "text/html"},
		{"GET", "/swagger.html", 200, "text/html"},
		{"GET", "/assets/app-123.js", 200, "javascript"},
		{"GET", "/assets/app-123.css", 200, "text/css"},
		{"GET", "/studio.svg", 200, "image/svg+xml"},
		{"GET", "/assets/", 404, "text/plain"},
		{"GET", "/assets/missing.js", 404, "text/plain"},
		{"GET", "/missing-page", 404, "text/plain"},
		{"GET", "/agent/missing.js", 404, "text/plain"},
		{"GET", "/monitor/missing.js", 404, "text/plain"},
		{"GET", "/sync/missing.js", 404, "text/plain"},
		{"GET", "/../master.key", 404, "text/plain"},
		{"POST", "/", 405, ""},
		{"POST", "/agent", 405, ""},
		{"POST", "/monitor", 405, ""},
		{"POST", "/sync", 405, ""},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequest(tc.method, tc.path, nil))
			if recorder.Code != tc.status || !strings.Contains(recorder.Header().Get("Content-Type"), tc.contentType) {
				t.Fatalf("status=%d content-type=%s body=%s", recorder.Code, recorder.Header().Get("Content-Type"), recorder.Body.String())
			}
			if tc.method == "HEAD" && recorder.Body.Len() != 0 {
				t.Fatal("HEAD returned a body")
			}
			if tc.status == 200 && tc.contentType == "text/html" && recorder.Header().Get("Cache-Control") != "no-cache" {
				t.Fatal("HTML entry must be revalidated")
			}
		})
	}
}

func TestExplicitDirectoryOverride(t *testing.T) {
	directory := t.TempDir()
	if err := os.WriteFile(filepath.Join(directory, "index.html"), []byte("disk override"), 0600); err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	router := gin.New()
	if err := Register(router, directory); err != nil {
		t.Fatal(err)
	}
	router.ServeHTTP(recorder, httptest.NewRequest("GET", "/", nil))
	if recorder.Code != 200 || recorder.Body.String() != "disk override" {
		t.Fatal("explicit directory did not override default assets", recorder.Code, recorder.Body.String())
	}
	recorder = httptest.NewRecorder()
	router = gin.New()
	if err := Register(router, filepath.Join(directory, "missing")); err != nil {
		t.Fatal(err)
	}
	router.ServeHTTP(recorder, httptest.NewRequest("GET", "/", nil))
	if recorder.Code != 404 {
		t.Fatal("invalid explicit directory unexpectedly fell back to default assets")
	}
}
