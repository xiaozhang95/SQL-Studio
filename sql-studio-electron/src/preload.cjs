const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sqlStudioDesktop', {
  titleBarHeight: process.platform === 'darwin' ? 24 : 32,
  setTitleBarTheme: (value) => ipcRenderer.send('sql-studio:titlebar-theme', value),
  updates: {
    check: () => ipcRenderer.invoke('sql-studio:check-updates'),
    download: () => ipcRenderer.invoke('sql-studio:download-update'),
    openRelease: () => ipcRenderer.invoke('sql-studio:open-release'),
    install: () => ipcRenderer.invoke('sql-studio:install-update')
  }
})
