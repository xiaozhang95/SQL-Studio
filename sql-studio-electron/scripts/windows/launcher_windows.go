package main

import (
	"errors"
	"fmt"
	"io"
	"log"
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
	logFile, logPath, logError := openLog()
	var writer io.Writer = io.Discard
	if logFile != nil {
		writer = logFile
		defer logFile.Close()
	}
	logger := log.New(writer, "", log.LstdFlags|log.Lmicroseconds)
	if err := launch(logger); err != nil {
		logger.Printf("启动失败: %v", err)
		detail := fmt.Sprintf("无法启动 SQL Studio。\n\n%v", err)
		if logError == nil {
			detail += "\n\n启动日志：" + logPath
		} else {
			detail += fmt.Sprintf("\n\n无法写入启动日志：%v", logError)
		}
		message := syscall.StringToUTF16Ptr(detail)
		title := syscall.StringToUTF16Ptr("SQL Studio")
		messageBox := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW")
		messageBox.Call(0, uintptr(unsafe.Pointer(message)), uintptr(unsafe.Pointer(title)), 0x10)
		os.Exit(1)
	}
}

func openLog() (*os.File, string, error) {
	directory := strings.TrimSpace(os.Getenv("SQL_STUDIO_DATA_DIR"))
	if directory == "" {
		homeDirectory, err := os.UserHomeDir()
		if err != nil {
			return nil, "", err
		}
		directory = filepath.Join(homeDirectory, ".sql-studio")
	}
	state := filepath.Join(directory, "state")
	if err := os.MkdirAll(state, 0o700); err != nil {
		return nil, "", err
	}
	logPath := filepath.Join(state, "launcher.log")
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	return file, logPath, err
}

func launch(logger *log.Logger) error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	directory := filepath.Dir(self)
	runtime := filepath.Join(directory, "sql-studio-runtime.exe")
	args := os.Args[1:]
	err = run(runtime, args, logger)
	if retryable(err) && !slices.Contains(args, "--no-sandbox") {
		logger.Print("Chromium 初始化失败，本次关闭沙箱重试")
		err = run(runtime, append(args, "--no-sandbox"), logger)
	}
	return err
}

func retryable(err error) bool {
	var exit *exec.ExitError
	if !errors.As(err, &exit) {
		return false
	}
	switch uint32(exit.ExitCode()) {
	case statusBreakpoint, statusAccessViolation:
		return true
	default:
		return false
	}
}

func run(runtime string, args []string, logger *log.Logger) error {
	logger.Printf("启动运行时: %s sandbox=%t", runtime, !slices.Contains(args, "--no-sandbox"))
	cmd := exec.Command(runtime, args...)
	cmd.Env = slices.DeleteFunc(os.Environ(), func(entry string) bool {
		name, _, _ := strings.Cut(entry, "=")
		return strings.EqualFold(name, "ELECTRON_RUN_AS_NODE")
	})
	cmd.Stderr = logger.Writer()
	err := cmd.Run()
	logger.Printf("运行时结束: %v", err)
	return err
}
