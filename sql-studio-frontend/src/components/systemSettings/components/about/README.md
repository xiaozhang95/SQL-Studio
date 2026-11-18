# 关于软件

`About({ disabled })` 在系统设置中显示 Vite 从前端 `package.json` 写入的产品版本，布局沿用 Ant Design。Web 和 Electron 共用同一个版本显示，仅 Electron 显示“检查更新”和“查看控制台”。后者通过 [useDesktopConsole](../../hooks/useDesktopConsole/README.md) 立即打开当前工作台的独立开发者工具窗口，不需要保存设置。`disabled` 随系统设置保存状态禁用操作。

检查后展示最新版本状态。Windows 安装版可在本页下载，点击“重启并安装”直接发起安装，不再弹出二次确认；请求期间按钮显示 loading 并禁用重复操作。桌面端也可打开 GitHub Release 手动下载。错误使用共享 ErrorNotice，分别提示限流、拒绝访问、超时和网络等原因；更新清单不可用时仍可显示发现的正式版本并提供手动下载。操作通过 [useDesktopUpdates](../../hooks/useDesktopUpdates/README.md) 调用桌面桥接，不依赖设置草稿提交。

下载使用 Ant Design 默认 Progress 展示真实百分比、已下载/总大小与当前速度，大小按 MiB 显示。下载尚未开始传输时显示“正在准备下载更新”，字节传输结束但校验未完成时显示“正在校验更新”；仅下载与校验成功后显示完成状态和安装按钮。下载失败将进度条标为失败并保留最后进度，重试重新计数。关闭和重新打开设置或切换设置分类后恢复主进程状态，不中断下载；普通网页和手动下载的版本不显示下载进度条。
