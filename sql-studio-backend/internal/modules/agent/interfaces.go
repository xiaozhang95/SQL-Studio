package agent

import (
	"context"
	"encoding/json"
	model "sql-studio-backend/internal/model/agent"
)

type Generator interface {
	Generate(context.Context, []model.Message, []model.Tool) (model.Message, error)
}
type Database interface {
	Connections(context.Context) ([]model.Connection, error)
	Databases(context.Context, string) ([]string, error)
	Execute(context.Context, model.Target, string, string, string) (json.RawMessage, error)
}

type StreamingGenerator interface {
	GenerateStream(context.Context, []model.Message, []model.Tool, func(model.Event) error) (model.Message, error)
}
type Repository interface {
	List(context.Context) ([]model.ConversationInfo, error)
	Load(context.Context, string) (model.Conversation, error)
	Save(context.Context, model.Conversation) (model.Conversation, error)
	Delete(context.Context, string) error
}
