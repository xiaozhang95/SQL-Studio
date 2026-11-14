package redistools

import (
	"reflect"
	"testing"
)

func TestSplitCommandPreservesRedisArguments(t *testing.T) {
	for _, tc := range []struct {
		line string
		want []string
	}{
		{` SET "a b" "line\nnext" `, []string{"SET", "a b", "line\nnext"}},
		{`SET "" "\xff"`, []string{"SET", "", "\xff"}},
		{`PUBLISH 'a:*' 'it\'s ok'`, []string{"PUBLISH", "a:*", "it's ok"}},
		{`MGET a;b path\name`, []string{"MGET", "a;b", `path\name`}},
	} {
		got, err := splitCommand(tc.line)
		if err != nil || !reflect.DeepEqual(got, tc.want) {
			t.Errorf("%q: got %q, %v, want %q", tc.line, got, err, tc.want)
		}
	}
	for _, line := range []string{"", "PING\nPING", `SET "broken`, `GET "a"b`, `"" abc`} {
		if _, err := splitCommand(line); err == nil {
			t.Errorf("accepted %q", line)
		}
	}
}
