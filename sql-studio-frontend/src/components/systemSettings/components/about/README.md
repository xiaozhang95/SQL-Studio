# 关于软件

`About({ disabled })` 在系统设置中显示 Vite 从前端 `package.json` 写入的产品版本，布局沿用 Ant Design。Web 和 Electron 共用同一个版本显示，仅 Electron 显示“检查更新”和“查看控制台”。后者通过 [useDesktopConsole](../../hooks/useDesktopConsole/README.md) 立即打开当前工作台的独立开发者工具窗口，不需要保存设置。`disabled` 随系统设置保存状态禁用操作。

检查后展示最新版本状态。Windows 安装版可在本页下载，点击“重启并安装”直接发起安装，不再弹出二次确认。请求期间禁用重复操作。桌面端也可打开 GitHub Release 手动下载。错误使用共享 ErrorNotice，分别提示限流、拒绝访问、超时和网络等原因；更新清单不可用时仍可显示发现的正式版本并提供手动下载。操作通过 [useDesktopUpdates](../../hooks/useDesktopUpdates/README.md) 调用桌面桥接，不依赖设置草稿提交。

下载时在按钮旁使用 Ant Design 圆形进度展示实际百分比，状态文案区分准备、下载和校验。校验成功后进度环随下载按钮让位给“重启并安装”。下载失败时进度环标为失败并保留最后进度，重试重新计数。关闭和重新打开设置或切换设置分类后恢复主进程状态，下载继续进行。应用内下载进度适用于支持自动下载的桌面安装版。
