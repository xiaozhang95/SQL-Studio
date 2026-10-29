//go:build embedded

package webui

import (
	"io/fs"
	"net/http/httptest"
	"regexp"
	"testing"
)

func TestEmbeddedBuildWorksOutsideRepository(t *testing.T) {
	t.Chdir(t.TempDir())
	index, err := fs.ReadFile(defaultFiles(), "index.html")
	if err != nil {
		t.Fatal(err)
	}
	asset := regexp.MustCompile(`/assets/[^"']+\.js`).Find(index)
	if len(asset) == 0 {
		t.Fatal("embedded index has no bundled application script")
	}
	router := testRouter(t, defaultFiles())
	for _, path := range []string{"/", "/swagger.html", "/studio.svg", string(asset)} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest("GET", path, nil))
		if recorder.Code != 200 || recorder.Body.Len() == 0 {
			t.Fatalf("embedded %s: status %d, bytes %d", path, recorder.Code, recorder.Body.Len())
		}
	}
}
