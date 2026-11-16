package redis

import (
	"strings"
	"testing"
)

func TestCollectionEditingPreservesStructureAndCanonicalOrder(t *testing.T) {
	for _, tc := range []struct{ kind, input, want string }{
		{"set", `["b","a"]`, "[\n  \"a\",\n  \"b\"\n]"},
		{"list", `["b","a","b"]`, "[\n  \"b\",\n  \"a\",\n  \"b\"\n]"},
		{"hash", `[["z","two"],["a","one"]]`, "[\n  [\n    \"a\",\n    \"one\"\n  ],\n  [\n    \"z\",\n    \"two\"\n  ]\n]"},
	} {
		value, err := parseCollectionValue(tc.kind, tc.input)
		if err != nil || value.text != tc.want {
			t.Errorf("%s: %q, %v", tc.kind, value.text, err)
		}
	}
	if _, err := parseCollectionValue("zset", `[["score","1.25"]]`); err != nil {
		t.Fatal(err)
	}
}

func TestCollectionEditingRejectsLossyOrAmbiguousInput(t *testing.T) {
	for _, tc := range []struct{ kind, input string }{
		{"set", `[]`}, {"list", `null`}, {"set", `["same","same"]`},
		{"list", `[null]`}, {"list", `[1]`}, {"set", `{"a":"b"}`},
		{"hash", `[["field",null]]`}, {"hash", `[["field","value","extra"]]`},
		{"hash", `[["field","a"],["field","b"]]`},
		{"zset", `[["member","NaN"]]`}, {"zset", `[["member","+Inf"]]`},
		{"stream", `[]`}, {"set", "[\"" + strings.Repeat("a", previewBytes) + "\"]"},
	} {
		if _, err := parseCollectionValue(tc.kind, tc.input); err == nil {
			t.Errorf("accepted %s %q", tc.kind, tc.input)
		}
	}
}
