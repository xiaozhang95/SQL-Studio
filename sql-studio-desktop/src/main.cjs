const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron')
const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { startBackend } = require('./backend.cjs')

app.setName('SQL Studio')
app.setAppUserModelId('com.sqlstudio.desktop')
app.enableSandbox()
if (process.env.SQLSTUDIO_DESKTOP_DATA_DIR) {
  const directory = path.resolve(process.env.SQLSTUDIO_DESKTOP_DATA_DIR)
  fs.mkdirSync(directory, { recursive: true })
  app.setPath('userData', directory)
}

let window, backend, launch, rendererReady = false, closing = false, exitApproved = false
const startup = new AbortController()
const hasLock = app.requestSingleInstanceLock()

function prepareClose() {
  if (!window || window.isDestroyed() || !rendererReady) return Promise.resolve()
  const contents = window.webContents
  return new Promise((resolve, reject) => {
    const id = randomUUID()
    const timer = setTimeout(() => finish(new Error('等待工作区保存超时。')), 15000)
    function finish(error) {
      clearTimeout(timer)
      ipcMain.removeListener('desktop:close-result', received)
      error ? reject(error) : resolve()
    }
    function received(event, result) {
      if (event.sender !== contents || event.senderFrame !== contents.mainFrame || result?.id !== id) return
      finish(result.ok === true ? undefined : new Error(typeof result.error === 'string' ? result.error.slice(0, 500) : '工作区保存失败。'))
    }
    ipcMain.on('desktop:close-result', received)
    contents.send('desktop:prepare-close', id)
  })
}

async function quit() {
  if (closing) return
  closing = true
  try {
    await prepareClose()
  } catch (error) {
    const result = await dialog.showMessageBox(window, {
      type: 'warning', title: '退出 SQL Studio', message: error.message,
      detail: '返回后可继续保存或取消正在进行的操作。直接退出会丢失尚未保存的修改。',
      buttons: ['返回编辑', '直接退出'], defaultId: 0, cancelId: 0, noLink: true
    })
    if (result.response !== 1) { closing = false; return }
  }
  startup.abort()
  await launch
  await backend?.stop()
  exitApproved = true
  app.quit()
}

if (!hasLock) app.quit()
else {
  app.on('second-instance', () => {
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })
  app.on('before-quit', (event) => {
    if (exitApproved) return
    event.preventDefault()
    void quit()
  })
  launch = app.whenReady().then(async () => {
    const binary = app.isPackaged
      ? path.join(process.resourcesPath, 'backend', 'sql-studio-backend.exe')
      : path.join(__dirname, '..', 'runtime', 'backend', 'sql-studio-backend.exe')
    backend = await startBackend({ binary, dataDir: app.getPath('userData'), signal: startup.signal, onExit: (error) => {
      if (closing) return
      dialog.showErrorBox('SQL Studio 后端已停止', error.message)
      void quit()
    } })
    if (closing) { await backend.stop(); return }
    window = new BrowserWindow({
      title: 'SQL Studio', width: 1440, height: 960, minWidth: 1000, minHeight: 700,
      show: false, backgroundColor: '#ffffff', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false }
    })
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '文件', submenu: [{ role: 'quit', label: '退出' }] },
      { label: '编辑', submenu: [{ role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' }, { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' }] },
      { label: '视图', submenu: [{ role: 'reload', label: '刷新' }, { role: 'togglefullscreen', label: '全屏' }, ...(!app.isPackaged ? [{ role: 'toggleDevTools', label: '开发者工具' }] : [])] }
    ]))
    const contents = window.webContents
    contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    contents.session.setPermissionCheckHandler(() => false)
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.on('will-navigate', (event, url) => {
      if (new URL(url).origin !== backend.origin) event.preventDefault()
    })
    contents.on('did-start-loading', () => { rendererReady = false })
    ipcMain.on('desktop:renderer-ready', (event) => {
      if (event.sender === contents && event.senderFrame === contents.mainFrame) rendererReady = true
    })
    window.on('close', (event) => {
      if (exitApproved) return
      event.preventDefault()
      app.quit()
    })
    window.once('ready-to-show', () => { if (!closing) window.show() })
    await window.loadURL(backend.origin)
  }).catch(async (error) => {
    if (!closing) dialog.showErrorBox('SQL Studio 启动失败', error.message)
    closing = true
    await backend?.stop()
    exitApproved = true
    app.quit()
  })
}
