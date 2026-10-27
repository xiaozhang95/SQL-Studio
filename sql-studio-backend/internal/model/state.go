package model

import (
	"encoding/json"
	"errors"
)

var ErrStateConflict = errors.New("配置已被其他窗口修改，请刷新页面后重试")

// ConnectionsSection 对应同目录连接文件，仅允许连接仓库访问。
const ConnectionsSection = "connections"

type StateDocument struct {
	SchemaVersion int                        `json:"schemaVersion"`
	Revision      uint64                     `json:"revision"`
	UpdatedAt     string                     `json:"updatedAt"`
	Data          json.RawMessage            `json:"data"`
	Extensions    map[string]json.RawMessage `json:"extensions,omitempty"`
}
type StateWrite struct {
	Revision uint64          `json:"revision"`
	Data     json.RawMessage `json:"data"`
}
