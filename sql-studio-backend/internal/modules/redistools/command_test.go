package redistools

import (
	"reflect"
	"strings"
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

func TestSplitCommandReportsByteLimit(t *testing.T) {
	line := "SET key  " + strings.Repeat("界", (64*1024-len("SET key  "))/len("界"))
	line += strings.Repeat("a", 64*1024-len(line))
	if _, err := splitCommand(line); err != nil {
		t.Fatal(err)
	}
	if _, err := splitCommand(line + "a"); err == nil || err.Error() != "Redis 命令超过 64 KiB 上限。" {
		t.Fatalf("unexpected error: %v", err)
	}
}
