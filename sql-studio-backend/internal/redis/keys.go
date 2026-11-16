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

// The Redis byte range can cut through a valid UTF-8 rune. Look at the bytes
// just past the display limit before deciding whether the prefix is binary.
func clipStringPreview(value string, limit int) string {
	if len(value) <= limit {
		return value
	}
	start := limit - 1
	for start > max(0, limit-utf8.UTFMax+1) && !utf8.RuneStart(value[start]) {
		start--
	}
	_, width := utf8.DecodeRuneInString(value[start:])
	if start+width > limit {
		return value[:start]
	}
	return value[:limit]
}

func (c *Client) Keys(ctx context.Context, connection model.Connection, db int, cursor uint64, pattern string) (model.RedisKeyPage, error) {
	ctx, release, err := c.beginRequest(ctx, connection.ID, db)
	if err != nil {
		return model.RedisKeyPage{}, err
	}
	defer release()
	client, closeClient := open(ctx, connection, db)
	defer closeClient()
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

func (c *Client) Key(ctx context.Context, connection model.Connection, db int, name string) (model.RedisKeyDetail, error) {
	ctx, release, err := c.beginRequest(ctx, connection.ID, db)
	if err != nil {
		return model.RedisKeyDetail{}, err
	}
	defer release()
	client, closeClient := open(ctx, connection, db)
	defer closeClient()
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
			detail.Preview, err = client.GetRange(ctx, name, 0, previewBytes+utf8.UTFMax-2).Result()
			detail.Truncated = detail.Size > previewBytes
			detail.Preview = clipStringPreview(detail.Preview, previewBytes)
		}
		detail.Editable = !detail.Truncated && utf8.ValidString(detail.Preview)
		detail.Preview = display(detail.Preview)
	case "list", "hash", "set", "zset":
		var value collectionValue
		value, err = readCollectionValue(ctx, client, kind, name)
		detail.Size, detail.Preview = value.size, value.text
		detail.Truncated, detail.Editable = value.truncated, value.editable
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

func (c *Client) KeyTTL(ctx context.Context, connection model.Connection, db int, name string) (model.RedisKeyTTL, error) {
	ctx, release, err := c.beginRequest(ctx, connection.ID, db)
	if err != nil {
		return model.RedisKeyTTL{}, err
	}
	defer release()
	client, closeClient := open(ctx, connection, db)
	defer closeClient()
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
