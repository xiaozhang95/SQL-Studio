package redis

import (
	"errors"
	"testing"

	"sql-studio-backend/internal/model"
)

func TestClusterScanCursorVisitsEveryPrimary(t *testing.T) {
	start, err := decodeClusterScanCursor("0", "topology", 2)
	if err != nil || start.index != 0 || start.position != 0 {
		t.Fatalf("invalid start: %+v %v", start, err)
	}
	samePrimary, err := decodeClusterScanCursor(start.advance(42, 2), "topology", 2)
	if err != nil || samePrimary.index != 0 || samePrimary.position != 42 {
		t.Fatalf("lost cursor within primary: %+v %v", samePrimary, err)
	}
	token := samePrimary.advance(0, 2)
	second, err := decodeClusterScanCursor(token, "topology", 2)
	if err != nil || second.index != 1 || second.position != 0 || second.advance(0, 2) != "0" {
		t.Fatalf("failed to finish both primaries: %+v %v", second, err)
	}
	if _, err := decodeClusterScanCursor(token, "changed", 1); !errors.Is(err, model.ErrRedisScanCursorExpired) {
		t.Fatalf("changed scan scope must invalidate the cursor: %v", err)
	}
	if _, err := decodeClusterScanCursor("malformed", "topology", 2); err == nil || errors.Is(err, model.ErrRedisScanCursorExpired) {
		t.Fatalf("malformed cursor must remain a validation error: %v", err)
	}
}
