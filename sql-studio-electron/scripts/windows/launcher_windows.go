package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"syscall"
	"unsafe"
)

const (
	statusBreakpoint      = 0x80000003
	statusAccessViolation = 0xc0000005
)

func main() {
	if err := launch(); err != nil {
		message := syscall.StringToUTF16Ptr(fmt.Sprintf("无法启动 SQL Studio。\n\n%v", err))
		title := syscall.StringToUTF16Ptr("SQL Studio")
		messageBox := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW")
		messageBox.Call(0, uintptr(unsafe.Pointer(message)), uintptr(unsafe.Pointer(title)), 0x10)
		os.Exit(1)
	}
}

func launch() error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	runtime := filepath.Join(filepath.Dir(self), "sql-studio-runtime.exe")
	args := os.Args[1:]
	err = run(runtime, args)
	var exit *exec.ExitError
	if errors.As(err, &exit) && !slices.Contains(args, "--no-sandbox") {
		// Chromium 可能在 Electron 主进程入口之前崩溃，重试需要由外部启动程序执行。
		switch uint32(exit.ExitCode()) {
		case statusBreakpoint, statusAccessViolation:
			err = run(runtime, append(args, "--no-sandbox"))
		}
	}
	if errors.As(err, &exit) && exit.ExitCode() == 1 {
		// Electron 已负责显示应用启动错误。
		return nil
	}
	return err
}

func run(runtime string, args []string) error {
	cmd := exec.Command(runtime, args...)
	cmd.Env = slices.DeleteFunc(os.Environ(), func(entry string) bool {
		name, _, _ := strings.Cut(entry, "=")
		return strings.EqualFold(name, "ELECTRON_RUN_AS_NODE")
	})
	return cmd.Run()
}
