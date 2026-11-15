package redis

import "testing"

func TestClipStringPreviewPreservesTextAndBinary(t *testing.T) {
	for _, tc := range []struct {
		name, value string
		limit       int
		want        string
	}{
		{"unicode crosses limit", "ab中尾", 4, "ab"},
		{"four byte rune crosses limit", "ab😀尾", 5, "ab"},
		{"binary on boundary", "ab\xe4\x80\xff", 4, "ab\xe4\x80"},
		{"complete rune at limit", "ab中尾", 5, "ab中"},
		{"full value", "中", 3, "中"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := clipStringPreview(tc.value, tc.limit); got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}
