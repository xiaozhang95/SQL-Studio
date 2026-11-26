export const desktopMessages = {
  'zh-CN': {
    startupFailed: 'SQL Studio 启动失败',
    serviceExited: 'SQL Studio 服务已退出',
    reopen: '请重新打开桌面应用。',
    quitTitle: '退出 SQL Studio',
    quitQuestion: '工作台没有响应，是否强制退出？',
    quitDetail: '尚未保存的 SQL 和其他修改可能丢失，连接清理可能无法完成。',
    cancel: '取消',
    forceQuit: '强制退出',
    workbenchTimeout: '工作台加载超时，请重新打开应用。',
    backendExited: '本地服务已退出。',
    backendStartFailed: '服务启动失败。',
    backendTimeout: (url) => `等待 SQL Studio 服务超时：${url}`,
    dataDirectoryError: (directory, detail) =>
      `无法初始化数据目录：\n${directory}\n\n${detail}\n\n请检查目录权限，或用 SQL_STUDIO_DATA_DIR 指定一个可写目录后重试。`,
    viteUnavailable: (url) => `无法连接前端 Vite 开发服务（${url}）。请在 sql-studio-frontend 目录运行 pnpm dev 后重试。`,
    proxyUnavailable: '无法通过 Vite 代理连接 Go 后端。请在 sql-studio-backend 目录运行 go run main.go，并确认后端监听 127.0.0.1:18080。'
  },
  'en-US': {
    startupFailed: 'SQL Studio could not start',
    serviceExited: 'The SQL Studio service stopped',
    reopen: 'Reopen the desktop app.',
    quitTitle: 'Quit SQL Studio',
    quitQuestion: 'The workspace is not responding. Force quit?',
    quitDetail: 'Unsaved SQL and other changes may be lost. Connections may remain open.',
    cancel: 'Cancel',
    forceQuit: 'Force quit',
    workbenchTimeout: 'The workspace took too long to load. Reopen the app.',
    backendExited: 'The local service stopped.',
    backendStartFailed: 'The local service could not start.',
    backendTimeout: (url) => `Timed out waiting for the SQL Studio service at ${url}`,
    dataDirectoryError: (directory, detail) =>
      `Could not initialize the data directory:\n${directory}\n\n${detail}\n\nCheck directory permissions or set SQL_STUDIO_DATA_DIR to a writable directory, then try again.`,
    viteUnavailable: (url) => `Could not connect to the Vite development server at ${url}. Run pnpm dev in sql-studio-frontend and try again.`,
    proxyUnavailable: 'Could not reach the Go backend through Vite. Run go run main.go in sql-studio-backend and verify that it is listening on 127.0.0.1:18080.'
  }
}
