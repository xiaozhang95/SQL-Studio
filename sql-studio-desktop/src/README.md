# Electron 主进程

`main.cjs` 为 Electron 入口，负责单实例、窗口、导航边界和关闭握手。`backend.cjs` 导出 `backendEnvironment(environment,stateDir,port)`、`freePort()`、`startBackend({binary,dataDir,signal?,onExit?,timeout=20000})`；启动成功返回 `{origin,pid,stop}`，错误或超时会停止自己创建的进程并抛错。`stop()` 可重复调用，不停止其他服务。端口探测与后端绑定间仍可能被其他进程抢占，此时由启动失败明确退出，不复用其他后端。

`preload.cjs` 仅暴露 `onBeforeClose(callback): unsubscribe`；不将原始 ipcRenderer、Node 对象或密钥交给页面。关闭结果限定为主窗口主 frame 及对应请求 ID。前端回调失败或 15 秒未响应，由原生对话框允许返回编辑或直接退出。

Windows 子进程隐藏控制台。正常应用退出结束专属后端；后台异常退出提示错误。Electron/操作系统强制杀进程不属于正常退出保障，不宣称数据库回滚。详细构建、镜像、目录和验证说明见 [桌面入口](../README.md)。
