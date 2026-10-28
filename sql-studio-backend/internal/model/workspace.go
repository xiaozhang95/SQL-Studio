package model

import "encoding/json"

const WorkspaceIndexSection = "workspace-index"
const WorkspacePartMaxBytes = 32 * 1024 * 1024

type WorkspacePage struct {
	ResultStatus string `json:"resultStatus,omitempty"`
	ResultSource string `json:"resultSource,omitempty"`
	Interrupted  bool   `json:"interrupted,omitempty"`
	ID           string `json:"id"`
	Title        string `json:"title"`
	Kind         string `json:"kind"`
	ConnectionID string `json:"connectionId"`
	Database     string `json:"database"`
	Schema       string `json:"schema,omitempty"`
	Table        string `json:"table"`
	DraftRef     string `json:"draftRef"`
	ResultRef    string `json:"resultRef"`
}
type WorkspaceIndex struct {
	Version           int                        `json:"version"`
	Tabs              []WorkspacePage            `json:"tabs"`
	ActiveTab         string                     `json:"activeTab"`
	ResultViews       map[string]json.RawMessage `json:"resultViews"`
	EditorLayouts     map[string]json.RawMessage `json:"editorLayouts"`
	Explorer          json.RawMessage            `json:"explorer"`
	ResultHeight      float64                    `json:"resultHeight"`
	SidebarWidth      float64                    `json:"sidebarWidth,omitempty"`
	OpenedConnections []string                   `json:"openedConnections"`
	RunningTabID      string                     `json:"runningTabId"`
}
type WorkspaceDocument struct {
	Revision uint64         `json:"revision"`
	Index    WorkspaceIndex `json:"index"`
}
type WorkspaceCommit struct {
	Revision uint64                     `json:"revision"`
	Index    WorkspaceIndex             `json:"index"`
	Drafts   map[string]string          `json:"drafts"`
	Results  map[string]json.RawMessage `json:"results"`
}
