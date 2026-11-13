# 关于软件

`About({ disabled })` 在系统设置中显示 Vite 从前端 `package.json` 写入的产品版本，布局沿用 Ant Design。Web 和 Electron 共用同一个版本显示，Electron 提供检查更新。`disabled` 随系统设置保存状态禁用操作。

检查后展示最新版本状态。Windows 安装版可在本页下载并确认重启安装，桌面端也可打开 GitHub Release 手动下载。错误使用共享 ErrorNotice。操作通过 [useDesktopUpdates](../../hooks/useDesktopUpdates/README.md) 调用桌面桥接，不依赖设置草稿提交。
