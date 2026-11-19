package redistools

import (
	"errors"
	"strconv"
	"strings"
)

var invalidCommand = errors.New("请输入一条有效的 Redis 命令")

// splitCommand matches the redis-cli conventions for quoted arguments,
// escapes, empty strings and literal byte sequences. No shell is involved.
func splitCommand(line string) ([]string, error) {
	if len(line) > 64*1024 {
		return nil, errors.New("Redis 命令超过 64 KiB 上限。")
	}
	if strings.ContainsAny(line, "\r\n") {
		return nil, invalidCommand
	}
	var args []string
	var arg strings.Builder
	for i := 0; i < len(line); {
		if line[i] == ' ' || line[i] == '\t' {
			i++
			continue
		}
		quote := byte(0)
		for ; i < len(line); i++ {
			c := line[i]
			if quote != 0 {
				if c == quote {
					quote = 0
					i++
					if i < len(line) && line[i] != ' ' && line[i] != '\t' {
						return nil, invalidCommand
					}
					break
				}
				if c == '\\' && i+1 < len(line) && (quote == '"' || line[i+1] == '\'') {
					i++
					c = line[i]
					if quote == '"' {
						switch c {
						case 'n':
							c = '\n'
						case 'r':
							c = '\r'
						case 't':
							c = '\t'
						case 'b':
							c = '\b'
						case 'a':
							c = '\a'
						case 'x':
							if i+2 < len(line) {
								value, err := strconv.ParseUint(line[i+1:i+3], 16, 8)
								if err == nil {
									c = byte(value)
									i += 2
								}
							}
						}
					}
				}
				arg.WriteByte(c)
				continue
			}
			if c == ' ' || c == '\t' {
				break
			}
			if c == '\'' || c == '"' {
				quote = c
			} else {
				arg.WriteByte(c)
			}
		}
		if quote != 0 {
			return nil, invalidCommand
		}
		args = append(args, arg.String())
		arg.Reset()
	}
	if len(args) == 0 || args[0] == "" {
		return nil, invalidCommand
	}
	for _, c := range args[0] {
		if !strings.ContainsRune("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.-", c) {
			return nil, invalidCommand
		}
	}
	return args, nil
}
