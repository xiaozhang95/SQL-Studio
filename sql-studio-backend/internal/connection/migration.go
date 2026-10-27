package connection

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
)

// Migrate 迁移旧连接文件和原密钥；验证完成前保留源文件，绝不覆盖不同的目标数据。
func Migrate(source, destination string) error {
	if source == "" {
		return nil
	}
	source, err := filepath.Abs(source)
	if err != nil {
		return err
	}
	destination, err = filepath.Abs(destination)
	if err != nil {
		return err
	}
	if source == destination {
		return nil
	}
	info, err := os.Stat(source)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("旧连接数据路径不是目录: %s", source)
	}
	if target, e := os.Stat(destination); e == nil && os.SameFile(info, target) {
		return nil
	}
	files := map[string][]byte{}
	// 先处理密钥，再发布连接文件；中断后可从相同字节继续，避免生成新密钥。
	for _, name := range []string{"master.key", "connections.json"} {
		data, e := os.ReadFile(filepath.Join(source, name))
		if os.IsNotExist(e) {
			continue
		}
		if e != nil {
			return e
		}
		files[name] = data
	}
	if len(files) == 0 {
		return nil
	}
	if _, ok := files["master.key"]; !ok {
		return fmt.Errorf("旧连接目录缺少 master.key，未迁移任何文件")
	}
	if err = validateCredentials(source); err != nil {
		return fmt.Errorf("旧连接数据无法解密，未迁移: %w", err)
	}
	for name, data := range files {
		target, e := os.ReadFile(filepath.Join(destination, name))
		if e != nil && !os.IsNotExist(e) {
			return e
		}
		if e == nil && !bytes.Equal(data, target) {
			return fmt.Errorf("用户目录已有不同的 %s，未覆盖；请先处理两份连接配置", name)
		}
	}
	if err = os.MkdirAll(destination, 0700); err != nil {
		return err
	}
	for _, name := range []string{"master.key", "connections.json"} {
		data, ok := files[name]
		if !ok {
			continue
		}
		path := filepath.Join(destination, name)
		file, e := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if os.IsExist(e) {
			existing, readErr := os.ReadFile(path)
			if readErr != nil || !bytes.Equal(data, existing) {
				return fmt.Errorf("迁移目标 %s 在迁移期间发生变化，已保留源文件", name)
			}
			continue
		}
		if e != nil {
			return e
		}
		_, e = file.Write(data)
		if e == nil {
			e = file.Sync()
		}
		closeErr := file.Close()
		if e == nil {
			e = closeErr
		}
		if e != nil {
			_ = os.Remove(path)
			return e
		}
	}
	if err = validateCredentials(destination); err != nil {
		return fmt.Errorf("迁移后连接校验失败，已保留源文件: %w", err)
	}
	for name, expected := range files {
		original, e := os.ReadFile(filepath.Join(source, name))
		if e != nil || !bytes.Equal(original, expected) {
			return fmt.Errorf("源 %s 发生变化，已停止清理", name)
		}
		copied, e := os.ReadFile(filepath.Join(destination, name))
		if e != nil || !bytes.Equal(copied, expected) {
			return fmt.Errorf("目标 %s 校验失败，已保留源文件", name)
		}
	}
	// 仅删除已校验的两个文件，目录非空时保留其他内容。
	for _, name := range []string{"connections.json", "master.key"} {
		if _, ok := files[name]; ok {
			if err = os.Remove(filepath.Join(source, name)); err != nil {
				return err
			}
		}
	}
	_ = os.Remove(source)
	return nil
}

func validateCredentials(directory string) error {
	store, err := Open(directory)
	if err != nil {
		return err
	}
	for _, item := range store.List() {
		if _, err = store.Get(item.ID); err != nil {
			return err
		}
	}
	return nil
}
