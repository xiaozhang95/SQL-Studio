import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

import { app, BrowserWindow, dialog, ipcMain, nativeImage, nativeTheme } from 'electron'

import { startBackend, waitForService } from './backend.mjs'
import { isAppURL, validTitleBarTheme } from './policy.mjs'
import { createStartupScreen } from './startup/index.mjs'
import { readStartupAppearance } from './startup/appearance.mjs'
import { createDesktopUpdates } from './updates.mjs'

// 默认状态目录与独立运行的 Go 服务一致。
const dataOverride = process.env.SQL_STUDIO_DATA_DIR?.trim()
const dataDirectory = dataOverride ? path.resolve(dataOverride) : path.join(app.getPath('home'), '.sql-studio')
app.setName('SQL Studio')
if (app.isPackaged && process.platform === 'win32') app.setAppUserModelId('com.sqlstudio.desktop')
const userDataDirectory = path.join(dataDirectory, 'electron')
const stateDirectory = path.join(dataDirectory, 'state')
// Chromium 只在默认路径下自建目录，自定义 userData 必须先落盘，否则单实例锁会因
// “路径不存在”创建失败，进程静默退出（双击没反应）。
let dataError = ''
try {
  mkdirSync(userDataDirectory, { recursive: true })
  mkdirSync(stateDirectory, { recursive: true })
  app.setPath('userData', userDataDirectory)
} catch (cause) {
  dataError = cause instanceof Error ? cause.message : String(cause)
}

function trace(message) {
  try {
    appendFileSync(path.join(stateDirectory, 'electron.log'), `[${new Date().toISOString()}] ${message}\n`)
  } catch {
    /* 诊断日志写不了就算了，不能影响启动。 */
  }
}

trace(`starting packaged=${app.isPackaged} data=${dataDirectory} ready=${!dataError}`)
let backend
let mainWindow
let quitting = false
let startupScreen
let startupTask
let shutdownTask
let allowQuit = false
const startupAbort = new AbortController()
const developmentURL = 'http://127.0.0.1:15173'

function shutdown(afterStop = () => app.quit()) {
  quitting = true
  startupAbort.abort()
  startupScreen?.dispose()
  shutdownTask ??= (async () => {
    await startupTask?.catch(() => {})
    await backend?.stop()
    allowQuit = true
    afterStop()
  })().catch((error) => {
    trace(`退出失败: ${error.stack ?? error.message}`)
    allowQuit = true
    app.quit()
  })
}

async function checkDevelopmentServices(signal) {
  const response = await fetch(`${developmentURL}/@vite/client`, {
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(2000)])
  }).catch(() => null)
  void response?.body?.cancel().catch(() => {})
  signal.throwIfAborted()
  if (!response?.ok || !response.headers.get('content-type')?.includes('javascript')) {
    throw new Error(`无法连接前端 Vite 开发服务（${developmentURL}）。请在 sql-studio-frontend 目录运行 pnpm dev 后重试。`)
  }

  try {
    await waitForService(developmentURL, { signal, timeout: 2000 })
  } catch (error) {
    signal.throwIfAborted()
    throw new Error('无法通过 Vite 代理连接 Go 后端。请在 sql-studio-backend 目录运行 go run main.go，并确认后端监听 127.0.0.1:18080。', { cause: error })
  }
}

async function loadIcons() {
  if (app.isPackaged) {
    const icon = nativeImage.createFromPath(path.join(process.resourcesPath, 'icon.png'))
    return { icon, appIcon: icon }
  }
  const { renderAppIcon } = await import('../scripts/icons.mjs')
  const icon = nativeImage.createFromBuffer(renderAppIcon())
  const appIcon = process.platform === 'darwin' ? nativeImage.createFromBuffer(renderAppIcon(true)) : icon
  return { icon, appIcon }
}

function createWindow(dark, appIcon, updates) {
  let origin = ''
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
  const isWorkbench = (event) => event.sender === contents && event.senderFrame && event.senderFrame === contents.mainFrame && isAppURL(event.senderFrame.url, origin)
  const syncTheme = (event, value) => {
    if (!isWorkbench(event) || !validTitleBarTheme(value)) return
    mainWindow?.setBackgroundColor(value.background)
    if (process.platform !== 'darwin') mainWindow?.setTitleBarOverlay({ color: value.background, symbolColor: value.foreground, height: 32 })
    reportThemeReady()
  }
  ipcMain.on('sql-studio:titlebar-theme', syncTheme)
  const desktopActions = {
    'sql-studio:version': () => app.getVersion(),
    'sql-studio:check-updates': updates.check,
    'sql-studio:download-update': updates.download,
    'sql-studio:open-release': updates.openRelease,
    'sql-studio:install-update': () => updates.install(shutdown)
  }
  for (const [channel, action] of Object.entries(desktopActions)) {
    ipcMain.handle(channel, async (event) => {
      if (!isWorkbench(event) || quitting) throw new Error('桌面操作不可用')
      try {
        return await action()
      } catch (error) {
        trace(`${channel}: ${error.stack ?? error.message}`)
        throw new Error('桌面操作失败')
      }
    })
  }
  contents.once('destroyed', () => {
    ipcMain.removeListener('sql-studio:titlebar-theme', syncTheme)
    for (const channel of Object.keys(desktopActions)) ipcMain.removeHandler(channel)
  })
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

if (dataError) {
  const message = `无法初始化数据目录：\n${dataDirectory}\n\n${dataError}\n\n请检查目录权限，或用 SQL_STUDIO_DATA_DIR 指定一个可写目录后重试。`
  console.error(`[electron] ${message}`)
  trace(`fatal: ${dataError}`)
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
    shutdown()
  })
  startupTask = app
    .whenReady()
    .then(async () => {
      if (!app.isPackaged) await checkDevelopmentServices(startupAbort.signal)
      const [appearance, { icon, appIcon }] = await Promise.all([
        readStartupAppearance(stateDirectory, nativeTheme.shouldUseDarkColors),
        loadIcons()
      ])
      startupAbort.signal.throwIfAborted()
      const desktop = createWindow(appearance.dark, appIcon, createDesktopUpdates(trace))
      startupScreen = await createStartupScreen(desktop.window, { icon, dark: appearance.dark, followSystem: appearance.preference === 'system' })
      startupAbort.signal.throwIfAborted()
      if (app.isPackaged) {
        backend = await startBackend(
          path.join(process.resourcesPath, 'runtime'),
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
      startupAbort.signal.throwIfAborted()
      startupScreen.setStage('workspace')
      await desktop.loadWorkbench(backend?.url ?? developmentURL)
      await startupScreen.complete()
      if (!desktop.window.isDestroyed()) desktop.window.webContents.focus()
    })
    .catch((error) => {
      trace(`启动失败: ${error?.stack || error?.message || error}`)
      if (!quitting) {
        startupScreen?.setStage('error')
        if (!app.isPackaged) console.error(`[electron] ${error.message}`)
        dialog.showErrorBox('SQL Studio 启动失败', error.message)
        if (!app.isPackaged) {
          startupScreen?.dispose()
          app.exit(1)
          return
        }
      }
      app.quit()
    })
}
