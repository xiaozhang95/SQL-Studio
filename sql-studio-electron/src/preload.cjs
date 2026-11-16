const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sqlStudioDesktop', {
  platform: process.platform,
  titleBarHeight: process.platform === 'darwin' ? 24 : 32,
  setTitleBarTheme: (value) => ipcRenderer.send('sql-studio:titlebar-theme', value),
  openConsole: () => ipcRenderer.invoke('sql-studio:open-console'),
  saveFile: {
    begin: (filename, filterName) => ipcRenderer.invoke('sql-studio:save-begin', filename, filterName),
    append: (id, bytes) => ipcRenderer.invoke('sql-studio:save-append', id, bytes),
    commit: (id) => ipcRenderer.invoke('sql-studio:save-commit', id),
    discard: (id) => ipcRenderer.invoke('sql-studio:save-discard', id)
  },
  updates: {
    check: () => ipcRenderer.invoke('sql-studio:check-updates'),
    download: () => ipcRenderer.invoke('sql-studio:download-update'),
    openRelease: () => ipcRenderer.invoke('sql-studio:open-release'),
    install: () => ipcRenderer.invoke('sql-studio:install-update')
  }
})
