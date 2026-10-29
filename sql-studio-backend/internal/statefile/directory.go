package statefile

import (
	"errors"
	"fmt"
	"os"
)

func directoryError(directory string, err error) error {
	if errors.Is(err, os.ErrPermission) {
		executable, _ := os.Executable()
		return fmt.Errorf("配置目录 %q 的写入被系统拒绝。后端进程 PID=%d，程序=%q。请确认浏览器连接的是此程序，并检查该进程的写入权限或系统拦截记录；配置目录保持不变，本次保存未完成: %w", directory, os.Getpid(), executable, err)
	}
	return fmt.Errorf("配置目录 %q 操作失败: %w", directory, err)
}
