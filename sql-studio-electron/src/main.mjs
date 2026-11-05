import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'

import { startBackend, waitForService } from './backend.mjs'
import { isAppURL, validTitleBarTheme } from './policy.mjs'
import { createStartupScreen } from './startup/index.mjs'
import { readStartupAppearance } from './startup/appearance.mjs'

app.setName('SQL Studio')
app.setPath('userData', path.join(app.getPath('appData'), 'sql-studio-electron'))
const dev = !app.isPackaged && process.argv.includes('--dev')
let backend
let mainWindow
let quitting = false
let startupScreen
let startupTask
let shutdownTask
let allowQuit = false
const startupAbort = new AbortController()

function createWindow(dark) {
  let origin = ''
  const icon = app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : fileURLToPath(new URL('../build/icons/icon.png', import.meta.url))
  const background = dark ? '#141414' : '#ffffff'
  mainWindow = new BrowserWindow({
    title: 'SQL Studio',
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    show: false,
    icon,
    backgroundColor: background,
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 12, y: 9 } }
      : {
          autoHideMenuBar: true,
          titleBarOverlay: { color: background, symbolColor: dark ? '#ffffff' : '#000000', height: 32 }
        }),
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  })
  const window = mainWindow
  let reportThemeReady
  const themeReady = new Promise((resolve) => {
    reportThemeReady = resolve
  })
  if (process.platform === 'darwin') app.dock?.setIcon(icon)
  const contents = mainWindow.webContents
  const syncTheme = (event, value) => {
    if (event.sender !== contents || event.senderFrame !== contents.mainFrame || !isAppURL(event.senderFrame.url, origin) || !validTitleBarTheme(value)) return
    mainWindow?.setBackgroundColor(value.background)
    if (process.platform !== 'darwin') mainWindow?.setTitleBarOverlay({ color: value.background, symbolColor: value.foreground, height: 32 })
    reportThemeReady()
  }
  ipcMain.on('sql-studio:titlebar-theme', syncTheme)
  contents.once('destroyed', () => ipcMain.removeListener('sql-studio:titlebar-theme', syncTheme))
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event, target) => {
    if (!isAppURL(target, origin)) event.preventDefault()
  })
  contents.on('will-redirect', (event, target) => {
    if (!isAppURL(target, origin)) event.preventDefault()
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  contents.session.setPermissionCheckHandler(() => false)
  mainWindow.on('closed', () => {
    mainWindow = undefined
  })
  return {
    window,
    icon,
    async loadWorkbench(url) {
      origin = new URL(url).origin
      const timeout = new AbortController()
      try {
        await Promise.race([
          Promise.all([window.loadURL(url), themeReady]),
          delay(20000, undefined, { signal: AbortSignal.any([timeout.signal, startupAbort.signal]) }).then(() => {
            throw new Error('工作台加载超时，请重新打开应用。')
          })
        ])
        startupAbort.signal.throwIfAborted()
      } finally {
        timeout.abort()
      }
    }
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore()
    mainWindow?.show()
    mainWindow?.focus()
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', (event) => {
    if (allowQuit) return
    event.preventDefault()
    quitting = true
    startupAbort.abort()
    startupScreen?.dispose()
    shutdownTask ||= (async () => {
      await startupTask?.catch(() => {})
      await backend?.stop()
      allowQuit = true
      app.quit()
    })()
  })
  startupTask = app
    .whenReady()
    .then(async () => {
      const stateDirectory = dev
        ? fileURLToPath(new URL('../../sql-studio-backend/.sql-studio/state', import.meta.url))
        : path.join(app.getPath('userData'), 'state')
      const appearance = await readStartupAppearance(stateDirectory, nativeTheme.shouldUseDarkColors)
      startupAbort.signal.throwIfAborted()
      const desktop = createWindow(appearance.dark)
      startupScreen = await createStartupScreen(desktop.window, { icon: desktop.icon, dark: appearance.dark, followSystem: appearance.preference === 'system' })
      startupAbort.signal.throwIfAborted()
      let url = 'http://127.0.0.1:15173'
      if (dev) {
        await waitForService(url, { signal: startupAbort.signal })
      } else {
        const runtime = app.isPackaged ? path.join(process.resourcesPath, 'runtime') : fileURLToPath(new URL('../build/runtime', import.meta.url))
        backend = await startBackend(
          runtime,
          app.getPath('userData'),
          () => {
            if (!quitting) {
              dialog.showErrorBox('SQL Studio 服务已退出', '请重新打开桌面应用。')
              app.quit()
            }
          },
          { signal: startupAbort.signal }
        )
      }
      if (quitting) {
        await backend?.stop()
        backend = undefined
        return
      }
      startupScreen.setStage('workspace')
      await desktop.loadWorkbench(backend?.url || url)
      await startupScreen.complete()
      if (!desktop.window.isDestroyed()) desktop.window.webContents.focus()
    })
    .catch((error) => {
      if (!quitting) {
        startupScreen?.setStage('error')
        dialog.showErrorBox('SQL Studio 启动失败', `${error.message}\n\n开发模式请先启动 Go 后端和 Vite；本地预览请先执行 pnpm prepare:runtime。`)
      }
      app.quit()
    })
}
