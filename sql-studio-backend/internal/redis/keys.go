package redis

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strconv"
	"unicode/utf8"

	"sql-studio-backend/internal/model"
)

const previewBytes = 16 * 1024
const previewItems = 50

// Redis keys and values are binary-safe. Use a reversible ID for addressing
// and an escaped display string when the bytes cannot be represented as UTF-8.
func display(value string) string {
	if !utf8.ValidString(value) {
		return "base64:" + base64.StdEncoding.EncodeToString([]byte(value))
	}
	return value
}

func clip(value string, size int) (string, bool) {
	if len(value) <= size {
		return value, false
	}
	for size > 0 && !utf8.RuneStart(value[size]) {
		size--
	}
	return value[:size], true
}

func (*Client) Keys(ctx context.Context, connection model.Connection, db int, cursor uint64, pattern string) (model.RedisKeyPage, error) {
	client := open(connection, db)
	defer client.Close()
	names, next, err := client.Scan(ctx, cursor, pattern, 100).Result()
	if err != nil {
		return model.RedisKeyPage{}, err
	}
	page := model.RedisKeyPage{Cursor: strconv.FormatUint(next, 10), Keys: make([]model.RedisKey, 0, len(names))}
	bytes := 0
	for _, name := range names {
		label, shortened := clip(display(name), 256)
		if shortened {
			label += "…"
		}
		ref := base64.RawURLEncoding.EncodeToString([]byte(name))
		bytes += len(label) + len(ref)
		if bytes > 512*1024 {
			return model.RedisKeyPage{}, errors.New("Redis 键列表过大，请缩小筛选范围")
		}
		page.Keys = append(page.Keys, model.RedisKey{Name: label, Ref: ref})
	}
	return page, nil
}

func (*Client) Key(ctx context.Context, connection model.Connection, db int, name string) (model.RedisKeyDetail, error) {
	client := open(connection, db)
	defer client.Close()
	kind, err := client.Type(ctx, name).Result()
	if err != nil {
		return model.RedisKeyDetail{}, err
	}
	ttl, err := client.Do(ctx, "PTTL", name).Int64()
	if err != nil {
		return model.RedisKeyDetail{}, err
	}
	if kind == "none" || ttl == -2 {
		return model.RedisKeyDetail{}, missingKey
	}
	detail := model.RedisKeyDetail{Type: kind, TTLMillis: ttl, Size: -1}
	if len(name) <= previewBytes && utf8.ValidString(name) {
		detail.Name = &name
	}
	var nested any
	switch kind {
	case "string":
		detail.Size, err = client.StrLen(ctx, name).Result()
		if err == nil {
			detail.Preview, err = client.GetRange(ctx, name, 0, previewBytes-1).Result()
			detail.Truncated = detail.Size > previewBytes
		}
		detail.Editable = !detail.Truncated && utf8.ValidString(detail.Preview)
		detail.Preview = display(detail.Preview)
	case "list":
		detail.Size, err = client.LLen(ctx, name).Result()
		if err == nil {
			nested, err = client.Do(ctx, "LRANGE", name, 0, previewItems-1).Result()
		}
		detail.Truncated = detail.Size > previewItems
	case "hash", "set", "zset":
		var entries []string
		var next uint64
		switch kind {
		case "hash":
			detail.Size, err = client.HLen(ctx, name).Result()
			if err == nil {
				entries, next, err = client.HScan(ctx, name, 0, "*", previewItems).Result()
			}
		case "set":
			detail.Size, err = client.SCard(ctx, name).Result()
			if err == nil {
				entries, next, err = client.SScan(ctx, name, 0, "*", previewItems).Result()
			}
		case "zset":
			detail.Size, err = client.ZCard(ctx, name).Result()
			if err == nil {
				entries, next, err = client.ZScan(ctx, name, 0, "*", previewItems).Result()
			}
		}
		capacity := previewItems
		if kind != "set" {
			capacity *= 2
		}
		detail.Truncated = next != 0 || len(entries) > capacity
		entries = entries[:min(len(entries), capacity)]
		if kind == "set" {
			nested = entries
		} else {
			pairs := make([][]string, 0, len(entries)/2)
			for i := 0; i+1 < len(entries); i += 2 {
				pairs = append(pairs, entries[i:i+2])
			}
			nested = pairs
		}
	case "stream":
		detail.Size, err = client.XLen(ctx, name).Result()
		if err == nil {
			nested, err = client.Do(ctx, "XRANGE", name, "-", "+", "COUNT", previewItems).Result()
		}
		detail.Truncated = detail.Size > previewItems
	}
	if err != nil {
		return model.RedisKeyDetail{}, err
	}
	if nested != nil {
		data, truncated := preview(nested, previewBytes)
		detail.Preview = data
		detail.Truncated = detail.Truncated || truncated
	}
	body, truncated := clip(detail.Preview, previewBytes)
	detail.Preview, detail.Truncated = body, detail.Truncated || truncated
	return detail, nil
}

func (*Client) KeyTTL(ctx context.Context, connection model.Connection, db int, name string) (model.RedisKeyTTL, error) {
	client := open(connection, db)
	defer client.Close()
	ttl, err := client.Do(ctx, "PTTL", name).Int64()
	return model.RedisKeyTTL{TTLMillis: ttl}, err
}

func preview(value any, limit int) (string, bool) {
	remaining := limit
	truncated := false
	var sanitize func(any) any
	list := func(length int, at func(int) any) []any {
		items := make([]any, 0, min(length, 64))
		for i := 0; i < length; i++ {
			if remaining <= 0 {
				truncated = true
				break
			}
			items = append(items, sanitize(at(i)))
		}
		return items
	}
	sanitize = func(item any) any {
		remaining -= 4
		switch v := item.(type) {
		case string:
			text, cut := clip(display(v), max(remaining, 0))
			remaining -= len(text)
			truncated = truncated || cut
			return text
		case []any:
			return list(len(v), func(i int) any { return v[i] })
		case []string:
			return list(len(v), func(i int) any { return v[i] })
		case [][]string:
			return list(len(v), func(i int) any { return v[i] })
		default:
			return item
		}
	}
	data, _ := json.MarshalIndent(sanitize(value), "", "  ")
	text, cut := clip(string(data), limit)
	return text, truncated || cut
}
