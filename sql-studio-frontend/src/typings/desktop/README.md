# 桌面契约

`onBeforeQuit(handler: () => Promise<boolean>): () => void` 注册异步退出准备并返回注销函数。preload 接收主进程生成的请求 ID 后，先通过 invoke 确认该请求仍然有效，才运行 handler；过期请求不会启动清理。等待 handler 完成，再仅对该 ID 回传允许/取消；异常视为取消。handler 必须完成 SQL 提示、工作区保存和连接释放后才返回 true。主进程校验当前窗口、主 frame 及同源来源，等待回执后才停止后端；重复关闭共享任务，已收到请求后的用户确认不受接收超时影响。Web 不提供此桥接，不增加 beforeunload 或 pagehide 清理操作。

`DesktopBridge` 为可选的 `window.sqlStudioDesktop`，由 Electron preload 提供。只读 `platform` 取自 Electron 的 process.platform，支持 win32/darwin/linux，供界面明确区分操作系统；`titleBarHeight` 为只读标题栏高度，`setTitleBarTheme(DesktopTitleBarTheme): void` 将界面的面板底色、文字颜色和亮暗模式发送给主进程，用于同步窗口底色和 Windows/Linux 透明底窗口按钮的图标颜色。普通浏览器不提供该对象。

`DesktopTitleBarTheme` 包含 background/foreground（三位或六位十六进制颜色）和 mode（light/dark）。主进程继续校验消息来源与颜色，不暴露通用 IPC 或数据库权限；保持系统主题源不变，避免阻断「跟随系统」。

`openConsole(): Promise<void>` 打开当前工作台的独立开发者工具窗口，无页面传入参数。主进程沿用窗口、主 frame 和同源校验，退出中拒绝；普通浏览器不提供该入口。关于软件页面调用此方法，不写入设置草稿。

`writeClipboardText(text: string): Promise<boolean>` 将原始文本写入系统剪贴板，成功返回 true。主进程仅接受当前工作台主 frame 的同源调用，退出中、参数不是字符串或系统写入失败时返回 false。该能力只写纯文本，不读取剪贴板，也不开放页面剪贴板权限。SQLPreview 在失败时静默处理，仅成功时显示“已复制”。

`saveFile.begin(filename, filterName)` 打开原生保存对话框，成功返回会话 ID 与实际路径，取消返回 `{ canceled: true }`。调用方依次等待 `append(id, bytes)` 写入 UTF-8 分块，再调用 `commit(id)` 发布完整文件。取消或失败调用 `discard(id)` 清理。路径由原生对话框决定。

`DesktopUpdates` 提供 `check()`、`download()`、`openRelease()` 和 `install()`。`check()` 返回 `DesktopUpdateStatus`，包括 `upToDate`、`available`（含版本及是否能在应用内下载）和 `downloaded`（含版本）；`download()` 成功后返回 `downloaded`。`openRelease()` 打开主进程选定的公开 GitHub 页面，`install()` 请求退出并安装已下载版本。主进程校验调用窗口和来源，失败时 Promise 拒绝。更新入口不接受页面传入的 URL、安装路径或命令。

`getState(): Promise<DesktopUpdateState>` 返回当前更新快照；`onState(handler): () => void` 订阅状态并返回注销函数，不向页面暴露 IPC event。DesktopUpdateState 包括递增 revision、可选 result、pending（check/download）、progress 和 error（操作及固定错误码）。DesktopUpdateProgress 包含 percent（0–100）、transferred、total、bytesPerSecond（非负有限数，后三项单位为字节或字节/秒）。总大小未知时为 0；失败保留最后进度，完成下载与校验后 percent 为 100，pending 清空，result 为 downloaded。仅向当前同源工作台发送事件；关闭设置不取消主进程任务，重新订阅时通过快照恢复。

更新 IPC 在主进程和 preload 之间使用 `{ok:true,value}` 或 `{ok:false,errorCode}`，preload 解包后保持上述 Promise 接口。DesktopUpdateErrorCode 定义可公开的固定错误码；拒绝时 Error.message 仅携带该码，由界面映射为对应语言文案。网络原始响应、错误堆栈和内部路径只留在桌面日志，不经更新桥接传入界面。控制台、保存文件及退出握手不采用该更新封装。
