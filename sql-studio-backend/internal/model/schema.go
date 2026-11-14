package model

type Table struct {
	Name             string   `json:"name"`
	Type             string   `json:"type"`
	Comment          string   `json:"comment"`
	ViewDependencies []string `json:"viewDependencies,omitempty"`
	Extension        string   `json:"extension,omitempty"`
}

type TableRef struct {
	Database string
	Name     string
}

type Column struct {
	Name      string  `json:"name"`
	Type      string  `json:"type"`
	Nullable  string  `json:"nullable"`
	Key       string  `json:"key"`
	Default   *string `json:"default"`
	Extra     string  `json:"extra"`
	Comment   string  `json:"comment"`
	Charset   string  `json:"charset,omitempty"`
	Collation string  `json:"collation,omitempty"`
}

// Index 保留复合索引的字段顺序；表达式索引的字段名可能为空。
type Index struct {
	Primary bool          `json:"primary,omitempty"`
	Name    string        `json:"name"`
	Unique  bool          `json:"unique"`
	Type    string        `json:"type"`
	Columns []IndexColumn `json:"columns"`
}

type IndexColumn struct {
	Name         string `json:"name"`
	Position     int    `json:"position"`
	PrefixLength *int   `json:"prefixLength"`
	Order        string `json:"order"`
}

type ForeignKey struct {
	Name             string             `json:"name"`
	ReferencedSchema string             `json:"referencedSchema"`
	ReferencedTable  string             `json:"referencedTable"`
	OnUpdate         string             `json:"onUpdate"`
	OnDelete         string             `json:"onDelete"`
	Columns          []ForeignKeyColumn `json:"columns"`
}

type ForeignKeyColumn struct {
	Name           string `json:"name"`
	ReferencedName string `json:"referencedName"`
}
