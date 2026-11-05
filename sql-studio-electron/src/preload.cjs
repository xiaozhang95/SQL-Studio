const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sqlStudioDesktop', {
  titleBarHeight: 32,
  setTitleBarTheme: (value) => ipcRenderer.send('sql-studio:titlebar-theme', value)
})
