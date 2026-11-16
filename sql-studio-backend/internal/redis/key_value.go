package redis

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"math"
	"sort"
	"strconv"
	"unicode/utf8"

	driver "github.com/redis/go-redis/v9"
)

type collectionValue struct {
	kind      string
	values    []string
	pairs     [][]string
	size      int64
	text      string
	truncated bool
	editable  bool
}

// 有序类型保留顺序；无序类型按成员/字段排序，使读取和 WATCH 比较使用同一表示。
func collectionText(value *collectionValue) (string, error) {
	seen := make(map[string]bool)
	var data any
	if value.kind == "set" || value.kind == "list" {
		if len(value.values) == 0 || len(value.values) > previewItems {
			return "", errors.New("Redis 集合需包含 1 至 50 个元素")
		}
		for _, item := range value.values {
			if !utf8.ValidString(item) {
				return "", errors.New("Redis 二进制值不支持直接编辑")
			}
			if value.kind == "set" && seen[item] {
				return "", errors.New("Redis 集合包含重复成员或字段")
			}
			seen[item] = true
		}
		if value.kind == "set" {
			sort.Strings(value.values)
		}
		data = value.values
	} else {
		if len(value.pairs) == 0 || len(value.pairs) > previewItems {
			return "", errors.New("Redis 集合需包含 1 至 50 个元素")
		}
		for _, pair := range value.pairs {
			if len(pair) != 2 || !utf8.ValidString(pair[0]) || !utf8.ValidString(pair[1]) {
				return "", errors.New("Redis Hash 或 ZSet 需使用两个字符串组成的数组项")
			}
			if seen[pair[0]] {
				return "", errors.New("Redis 集合包含重复成员或字段")
			}
			seen[pair[0]] = true
			if value.kind == "zset" {
				score, err := strconv.ParseFloat(pair[1], 64)
				if err != nil || math.IsNaN(score) || math.IsInf(score, 0) {
					return "", errors.New("Redis ZSet 分数无效")
				}
			}
		}
		sort.Slice(value.pairs, func(i, j int) bool { return value.pairs[i][0] < value.pairs[j][0] })
		data = value.pairs
	}
	encoded, err := json.MarshalIndent(data, "", "  ")
	if err != nil || len(encoded) > previewBytes {
		return "", errors.New("Redis 键值超过编辑上限或未提供")
	}
	return string(encoded), nil
}

func parseCollectionValue(kind, text string) (collectionValue, error) {
	value := collectionValue{kind: kind}
	if kind != "set" && kind != "list" && kind != "hash" && kind != "zset" {
		return value, errors.New("当前 Redis 类型不支持直接编辑")
	}
	var rows []json.RawMessage
	if json.Unmarshal([]byte(text), &rows) != nil {
		return value, errors.New("Redis 集合值必须是有效的 JSON 字符串数组")
	}
	readString := func(raw json.RawMessage) (string, error) {
		raw = bytes.TrimSpace(raw)
		var item string
		if len(raw) == 0 || raw[0] != '"' || json.Unmarshal(raw, &item) != nil {
			return "", errors.New("Redis 集合值必须是有效的 JSON 字符串数组")
		}
		return item, nil
	}
	for _, row := range rows {
		if kind == "set" || kind == "list" {
			item, err := readString(row)
			if err != nil {
				return value, err
			}
			value.values = append(value.values, item)
		} else {
			var pair []json.RawMessage
			if json.Unmarshal(row, &pair) != nil || len(pair) != 2 {
				return value, errors.New("Redis Hash 或 ZSet 需使用两个字符串组成的数组项")
			}
			items := make([]string, 2)
			for index, raw := range pair {
				item, err := readString(raw)
				if err != nil {
					return value, err
				}
				items[index] = item
			}
			value.pairs = append(value.pairs, items)
		}
	}
	var err error
	value.text, err = collectionText(&value)
	return value, err
}

func readCollectionValue(ctx context.Context, client driver.Cmdable, kind, name string) (collectionValue, error) {
	value := collectionValue{kind: kind}
	var err error
	var entries []string
	var next uint64
	switch kind {
	case "list":
		value.size, err = client.LLen(ctx, name).Result()
		if err == nil {
			value.values, err = client.LRange(ctx, name, 0, previewItems-1).Result()
		}
		value.truncated = value.size != int64(len(value.values))
	case "set":
		value.size, err = client.SCard(ctx, name).Result()
		if err == nil {
			entries, next, err = client.SScan(ctx, name, 0, "*", previewItems).Result()
		}
	case "hash":
		value.size, err = client.HLen(ctx, name).Result()
		if err == nil {
			entries, next, err = client.HScan(ctx, name, 0, "*", previewItems).Result()
		}
	case "zset":
		value.size, err = client.ZCard(ctx, name).Result()
		if err == nil {
			entries, next, err = client.ZScan(ctx, name, 0, "*", previewItems).Result()
		}
	default:
		return value, errors.New("当前 Redis 类型不支持直接编辑")
	}
	if err != nil {
		return value, err
	}
	var nested any
	if kind == "list" {
		nested = value.values
	} else if kind == "set" {
		value.truncated = next != 0 || value.size != int64(len(entries)) || len(entries) > previewItems
		value.values = entries[:min(len(entries), previewItems)]
		nested = value.values
	} else {
		value.truncated = next != 0 || len(entries)%2 != 0 || value.size != int64(len(entries)/2) || len(entries) > previewItems*2
		entries = entries[:min(len(entries), previewItems*2)]
		for i := 0; i+1 < len(entries); i += 2 {
			value.pairs = append(value.pairs, entries[i:i+2])
		}
		nested = value.pairs
	}
	if !value.truncated {
		if value.text, err = collectionText(&value); err == nil {
			value.editable = true
			return value, nil
		}
	}
	text, truncated := preview(nested, previewBytes)
	value.text, value.truncated = text, value.truncated || truncated
	return value, nil
}

// 先新增再移除旧成员，避免非空集合替换时短暂消失而丢失 TTL。
func applyCollectionValue(ctx context.Context, pipe driver.Pipeliner, name string, current, next collectionValue) {
	switch next.kind {
	case "list":
		for index := 0; index < min(len(current.values), len(next.values)); index++ {
			pipe.LSet(ctx, name, int64(index), next.values[index])
		}
		if len(next.values) > len(current.values) {
			items := make([]any, 0, len(next.values)-len(current.values))
			for _, item := range next.values[len(current.values):] {
				items = append(items, item)
			}
			pipe.RPush(ctx, name, items...)
		} else if len(next.values) < len(current.values) {
			pipe.LTrim(ctx, name, 0, int64(len(next.values)-1))
		}
	case "set":
		items := make([]any, 0, len(next.values))
		wanted := make(map[string]bool)
		for _, item := range next.values {
			items = append(items, item)
			wanted[item] = true
		}
		pipe.SAdd(ctx, name, items...)
		removed := make([]any, 0)
		for _, item := range current.values {
			if !wanted[item] {
				removed = append(removed, item)
			}
		}
		if len(removed) > 0 {
			pipe.SRem(ctx, name, removed...)
		}
	case "hash", "zset":
		wanted := make(map[string]bool)
		fields := make([]any, 0, len(next.pairs)*2)
		members := make([]driver.Z, 0, len(next.pairs))
		for _, pair := range next.pairs {
			wanted[pair[0]] = true
			fields = append(fields, pair[0], pair[1])
			if next.kind == "zset" {
				score, _ := strconv.ParseFloat(pair[1], 64)
				members = append(members, driver.Z{Score: score, Member: pair[0]})
			}
		}
		if next.kind == "hash" {
			pipe.HSet(ctx, name, fields...)
		} else {
			pipe.ZAdd(ctx, name, members...)
		}
		removed := make([]string, 0)
		for _, pair := range current.pairs {
			if !wanted[pair[0]] {
				removed = append(removed, pair[0])
			}
		}
		if len(removed) > 0 {
			if next.kind == "hash" {
				pipe.HDel(ctx, name, removed...)
			} else {
				items := make([]any, len(removed))
				for index, item := range removed {
					items[index] = item
				}
				pipe.ZRem(ctx, name, items...)
			}
		}
	}
}
