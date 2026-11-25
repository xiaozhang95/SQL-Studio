# 关于软件

`About({ disabled, updates })` 在系统设置中以「当前版本 + 版本号」展示 Vite 写入的产品版本。Web 和 Electron 共用同一个版本显示，仅 Electron 显示“检查更新”和“查看控制台”。后者通过 [useDesktopConsole](../../hooks/useDesktopConsole/README.md) 打开当前工作台的独立开发者工具窗口。`disabled` 随系统设置保存状态禁用操作，`updates` 由侧栏传入。

检查后展示最新版本状态。Windows 安装版可在本页下载，点击「重启并安装」直接发起安装流程。请求期间禁用重复操作。桌面端点击「手动下载」打开 GitHub Release。错误使用共享 ErrorNotice，分别提示限流、拒绝访问、超时和网络等原因；更新清单不可用时仍可显示发现的正式版本并提供手动下载。操作通过 [useDesktopUpdates](../../../../hooks/useDesktopUpdates/README.md) 调用桌面桥接，不依赖设置草稿提交。

下载时用 Ant Design 圆形进度环替换「下载更新」按钮左侧图标，进度弧使用主题主色，轨道使用中性边框色。状态文案区分准备、下载和校验。校验成功后显示「重启并安装」。下载失败时进度弧使用主题错误色并保留最后进度，重试从头计数。关闭设置或切换分类时，[侧栏入口](../../../appRail/components/updateIndicator/README.md)继续展示同一下载状态，并在校验完成后提供安装操作。
