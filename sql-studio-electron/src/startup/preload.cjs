const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sqlStudioStartup', {
  onStage: (callback) => {
    ipcRenderer.on('sql-studio:startup-stage', (_event, stage) => callback(stage))
  },
  onTheme: (callback) => {
    ipcRenderer.on('sql-studio:startup-theme', (_event, theme) => callback(theme))
  }
})
