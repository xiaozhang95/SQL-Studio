import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'

import { startBackend, waitForService } from './backend.mjs'
import { isAppURL, validTitleBarTheme } from './policy.mjs'
import { createStartupScreen } from './startup/index.mjs'
import { readStartupAppearance } from './startup/appearance.mjs'

// 数据统一放在 .sql-studio，与 Go 服务（go run main.go）用的是同一个目录：
// Chromium 用户数据在 electron/，连接、密钥与工作区状态在 state/。便携运行或受限终端
// （%APPDATA% 不可写）可以用 SQL_STUDIO_DATA_DIR 换一个数据根。
function ensureDirectory(directory) {
  try {
    mkdirSync(directory, { recursive: true })
    return true
  } catch {
    return false
  }
}

const dataDirectory = (() => {
  const override = process.env.SQL_STUDIO_DATA_DIR?.trim()
  if (override) return path.resolve(override)
  if (app.isPackaged) {
    // 绿色版优先把数据放在 exe 同级的 .sql-studio；portable 目录只读时退回 AppData。
    const portable = path.join(path.dirname(app.getPath('exe')), '.sql-studio')
    if (ensureDirectory(path.join(portable, 'electron'))) return portable
    return path.join(app.getPath('appData'), 'sql-studio-electron')
  }
  return fileURLToPath(new URL('../../sql-studio-backend/.sql-studio', import.meta.url))
})()
app.setName('SQL Studio')
const userDataDirectory = path.join(dataDirectory, 'electron')
const stateDirectory = path.join(dataDirectory, 'state')
// Chromium 只在默认路径下自建目录，自定义 userData 必须先落盘，否则单实例锁会因
// “路径不存在”创建失败，进程静默退出（双击没反应）。
const userDataReady = ensureDirectory(userDataDirectory)
ensureDirectory(stateDirectory)
app.setPath('userData', userDataDirectory)

function trace(message) {
  try {
    appendFileSync(path.join(stateDirectory, 'electron.log'), `[${new Date().toISOString()}] ${message}\n`)
  } catch {
    /* 诊断日志写不了就算了，不能影响启动。 */
  }
}

trace(`starting packaged=${app.isPackaged} data=${dataDirectory} userData=${userDataReady}`)
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
  const iconDirectory = app.isPackaged ? process.resourcesPath : fileURLToPath(new URL('../build/icons/', import.meta.url))
  const icon = path.join(iconDirectory, 'icon.png')
  const appIcon = path.join(iconDirectory, process.platform === 'darwin' ? 'mac-icon.png' : 'icon.png')
  const background = dark ? '#141414' : '#ffffff'
  mainWindow = new BrowserWindow({
    title: 'SQL Studio',
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    show: false,
    ...(process.platform === 'darwin' ? {} : { icon: appIcon }),
    backgroundColor: background,
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 12, y: 6 } }
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
  // 打包版使用 ICNS，由 macOS 统一管理 Dock 图标；开发预览才覆盖 Electron 默认图标。
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(appIcon)
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

if (!userDataReady) {
  const message = `无法创建数据目录：\n${userDataDirectory}\n\n请检查磁盘空间与安全软件，或用 SQL_STUDIO_DATA_DIR 指定一个可写目录后重试。`
  trace(`fatal: userData 不可写 ${userDataDirectory}`)
  dialog.showErrorBox('SQL Studio 无法启动', message)
  app.exit(1)
} else if (!app.requestSingleInstanceLock()) {
  // 锁失败既可能是“已有实例在运行”，也可能是数据目录不可写，都写进日志便于排查。
  trace('single instance lock 获取失败，退出')
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
          dataDirectory,
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
      trace(`启动失败: ${error?.stack || error?.message || error}`)
      if (!quitting) {
        startupScreen?.setStage('error')
        dialog.showErrorBox('SQL Studio 启动失败', `${error.message}\n\n开发模式请先启动 Go 后端和 Vite；本地预览请先执行 pnpm bundle。`)
      }
      app.quit()
    })
}
