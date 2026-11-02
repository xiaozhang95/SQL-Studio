const { contextBridge, ipcRenderer } = require('electron')

// Only a close handshake is exposed. The renderer cannot access files, processes or arbitrary IPC.
contextBridge.exposeInMainWorld('sqlStudioDesktop', {
  onBeforeClose(callback) {
    const listener = async (_event, id) => {
      try {
        await callback()
        ipcRenderer.send('desktop:close-result', { id, ok: true })
      } catch (error) {
        ipcRenderer.send('desktop:close-result', { id, ok: false, error: error instanceof Error ? error.message.slice(0, 500) : '工作区保存失败' })
      }
    }
    ipcRenderer.on('desktop:prepare-close', listener)
    ipcRenderer.send('desktop:renderer-ready')
    return () => ipcRenderer.removeListener('desktop:prepare-close', listener)
  }
})
