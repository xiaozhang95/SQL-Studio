# Electron 生命周期

`useDesktopLifecycle({ready,saving,error?,blocked,flush})` 仅在 Electron 退出桥接存在时注册保存回调；浏览器环境不注册。`flush()` 同步当前 CodeMirror 缓冲，等待两帧使 React 发布草稿和保存状态，然后等待工作区、历史和主题的真实保存完成，最长 10 秒。

读取未完成、保存失败、有进行中的操作/导出或表格未保存修改时拒绝关闭；Electron 主进程允许返回编辑或显式直接退出。不会执行 SQL、隐式提交表格、读取凭据或更改普通浏览器的页面关闭行为。`waitForDesktopSave(read,flush,nextFrame,timeout=10000)` 为同一流程的可测试入口，错误通过 rejected Promise 返回；hook 卸载注销回调。
