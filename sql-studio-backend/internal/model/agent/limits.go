package model

import "errors"

const (
	MessageNoticeBytes = 64 * 1024
	MessageMaxBytes    = 256 * 1024
	ToolNoticeBytes    = 32 * 1024
	ToolMaxBytes       = 256 * 1024
	// JSON can use six bytes to encode a single control character.
	MessageJSONMaxBytes = 6*MessageMaxBytes + 32*1024
)

var (
	ErrToolResultTooLarge = errors.New("结果超过 256 KiB，请缩小查询范围")
	ErrReadOperation      = errors.New("数据库读取失败")
	ErrContinueCancelled  = errors.New("已停止本轮，未继续执行后续步骤")
)
