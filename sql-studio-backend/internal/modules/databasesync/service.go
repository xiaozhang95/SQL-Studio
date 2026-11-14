package databasesync

import (
	"context"
	"errors"
	"net/netip"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"sql-studio-backend/internal/model"
)

type connections interface {
	Get(string) (model.Connection, error)
}

type Engine interface {
	SyncDatabases(context.Context, model.Connection) ([]string, error)
	CheckDatabaseSync(context.Context, model.Connection, model.Connection, model.DatabaseSyncRequest) (model.DatabaseSyncPlan, error)
	SyncDatabase(context.Context, model.Connection, model.Connection, model.DatabaseSyncRequest, func(model.DatabaseSyncProgress) error) error
}

type Service struct {
	connections connections
	engines     map[string]Engine
	running     chan struct{}
}

var ErrBusy = errors.New("已有数据库同步任务正在执行")
var invalidExternal = errors.New("外部连接信息无效，请检查主机、端口和认证信息")

func New(connections connections, engines map[string]Engine) *Service {
	return &Service{connections: connections, engines: engines, running: make(chan struct{}, 1)}
}

func (s *Service) Databases(ctx context.Context, endpoint model.DatabaseSyncConnection) ([]string, error) {
	connection, err := s.connection(endpoint.ConnectionID, endpoint.External)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	names, err := s.engines[connection.Type].SyncDatabases(ctx, connection)
	if err != nil {
		return nil, err
	}
	available := make([]string, 0, len(names))
	for _, name := range names {
		if validDatabase(connection.Type, name) {
			available = append(available, name)
		}
	}
	return available, nil
}

func (s *Service) Check(ctx context.Context, input model.DatabaseSyncRequest) (model.DatabaseSyncPlan, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	source, target, err := s.resolve(input)
	if err != nil {
		return model.DatabaseSyncPlan{}, err
	}
	return s.engines[source.Type].CheckDatabaseSync(ctx, source, target, input)
}

func (s *Service) Run(ctx context.Context, input model.DatabaseSyncRequest, emit func(model.DatabaseSyncProgress) error) error {
	source, target, err := s.resolve(input)
	if err != nil {
		return err
	}
	select {
	case s.running <- struct{}{}:
		defer func() { <-s.running }()
	default:
		return ErrBusy
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()
	return s.engines[source.Type].SyncDatabase(ctx, source, target, input, emit)
}

func (s *Service) resolve(input model.DatabaseSyncRequest) (source, target model.Connection, err error) {
	if !input.Structure {
		err = errors.New("同步到新数据库必须勾选表结构")
		return
	}
	source, err = s.connection(input.SourceConnectionID, input.SourceExternal)
	if err != nil {
		return
	}
	target, err = s.connection(input.TargetConnectionID, input.TargetExternal)
	if err != nil {
		return
	}
	if source.Type != target.Type {
		err = errors.New("源连接和目标连接必须使用相同的数据库类型")
	} else if !validDatabase(source.Type, input.SourceDatabase) || !validDatabase(target.Type, input.TargetDatabase) {
		err = errors.New("请选择有效的源数据库和目标数据库名称")
	}
	return
}

func (s *Service) connection(id string, external *model.DatabaseSyncExternal) (model.Connection, error) {
	if (id == "") == (external == nil) {
		return model.Connection{}, errors.New("请为每一端选择已保存连接或填写外部连接")
	}
	if external == nil {
		c, err := s.connections.Get(id)
		c.Type = model.NormalizeDatabaseType(c.Type)
		if err == nil && s.engines[c.Type] == nil {
			return model.Connection{}, errors.New("该数据库类型暂不支持同步")
		}
		return c, err
	}
	kind := model.NormalizeDatabaseType(external.Type)
	if s.engines[kind] == nil {
		return model.Connection{}, errors.New("该数据库类型暂不支持同步")
	}
	database := strings.TrimSpace(external.Database)
	if database != "" && (len(database) > 255 || strings.ContainsFunc(database, unicode.IsControl) || kind == model.TypeMySQL || kind == model.TypeMariaDB) {
		return model.Connection{}, invalidExternal
	}
	host := strings.TrimSpace(external.Host)
	if strings.HasPrefix(host, "[") && strings.HasSuffix(host, "]") {
		host = host[1 : len(host)-1]
		if ip, err := netip.ParseAddr(host); err != nil || !ip.Is6() {
			return model.Connection{}, invalidExternal
		}
	}
	ip, ipErr := netip.ParseAddr(host)
	if host == "" || len(host) > 255 || (ipErr != nil && strings.ContainsAny(host, ":[]%")) ||
		(ipErr == nil && ip.IsUnspecified()) || strings.ContainsAny(host, `/\\?#@()`) || strings.ContainsFunc(host, func(r rune) bool { return unicode.IsControl(r) || unicode.IsSpace(r) }) ||
		(kind != model.TypeGreptimeDB && strings.TrimSpace(external.Username) == "") || len(external.Username) > 256 || strings.ContainsFunc(external.Username, unicode.IsControl) ||
		external.Port < 1 || external.Port > 65535 || len(external.Password) > 4096 {
		return model.Connection{}, invalidExternal
	}
	return model.Connection{Type: kind, Database: database, Host: host, Port: external.Port, Username: external.Username, Password: external.Password, TLS: external.TLS}, nil
}

func validDatabase(kind, name string) bool {
	if kind == model.TypePostgreSQL && (len(name) > 63 || strings.EqualFold(name, "template0") || strings.EqualFold(name, "template1")) {
		return false
	}
	if name == "" || strings.TrimSpace(name) != name || !utf8.ValidString(name) || utf8.RuneCountInString(name) > 64 ||
		strings.ContainsAny(name, "./\\") || strings.ContainsFunc(name, unicode.IsControl) {
		return false
	}
	switch strings.ToLower(name) {
	case "mysql", "information_schema", "performance_schema", "sys":
		return false
	}
	return true
}
