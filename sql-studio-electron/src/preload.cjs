const { contextBridge, ipcRenderer } = require('electron')

async function updateAction(channel) {
  const result = await ipcRenderer.invoke(channel)
  if (result?.ok !== true) throw new Error(typeof result?.errorCode === 'string' ? result.errorCode : 'UPDATE_FAILED')
  return result.value
}

contextBridge.exposeInMainWorld('sqlStudioDesktop', {
  platform: process.platform,
  titleBarHeight: process.platform === 'darwin' ? 24 : 32,
  setTitleBarTheme: (value) => ipcRenderer.send('sql-studio:titlebar-theme', value),
  openConsole: () => ipcRenderer.invoke('sql-studio:open-console'),
  writeClipboardText: (text) => ipcRenderer.invoke('sql-studio:write-clipboard-text', text),
  onBeforeQuit: (handler) => {
    const prepare = (_event, id) => {
      if (typeof id !== 'string') return
      ipcRenderer
        .invoke('sql-studio:quit-received', id)
        .then(async (accepted) => {
          if (accepted !== true) return
          const allowed = await handler()
          ipcRenderer.send('sql-studio:quit-prepared', id, allowed === true)
        })
        .catch(() => ipcRenderer.send('sql-studio:quit-prepared', id, false))
    }
    ipcRenderer.on('sql-studio:prepare-quit', prepare)
    ipcRenderer.send('sql-studio:quit-ready', true)
    return () => {
      ipcRenderer.removeListener('sql-studio:prepare-quit', prepare)
      ipcRenderer.send('sql-studio:quit-ready', false)
    }
  },
  saveFile: {
    begin: (filename, filterName) => ipcRenderer.invoke('sql-studio:save-begin', filename, filterName),
    append: (id, bytes) => ipcRenderer.invoke('sql-studio:save-append', id, bytes),
    commit: (id) => ipcRenderer.invoke('sql-studio:save-commit', id),
    discard: (id) => ipcRenderer.invoke('sql-studio:save-discard', id)
  },
  updates: {
    getState: () => updateAction('sql-studio:get-update-state'),
    onState: (handler) => {
      const listener = (_event, state) => handler(state)
      ipcRenderer.on('sql-studio:updates-changed', listener)
      return () => ipcRenderer.removeListener('sql-studio:updates-changed', listener)
    },
    check: () => updateAction('sql-studio:check-updates'),
    download: () => updateAction('sql-studio:download-update'),
    openRelease: () => updateAction('sql-studio:open-release'),
    install: () => updateAction('sql-studio:install-update')
  }
})
