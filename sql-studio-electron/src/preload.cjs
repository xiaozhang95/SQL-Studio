const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sqlStudioDesktop', {
  titleBarHeight: process.platform === 'darwin' ? 24 : 32,
  setTitleBarTheme: (value) => ipcRenderer.send('sql-studio:titlebar-theme', value)
})
