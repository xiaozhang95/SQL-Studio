import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, nativeTheme } from 'electron'

import { startBackend, waitForService } from './backend.mjs'
import { createClipboardWriter } from './clipboard.mjs'
import { isAppURL, validTitleBarTheme } from './policy.mjs'
import { createQuitGuard } from './quit.mjs'
import { createSQLSaves } from './sql-save.mjs'
import { readStartupAppearance } from './startup/appearance.mjs'
import { createStartupScreen } from './startup/index.mjs'
import { createDesktopUpdates, desktopUpdateErrorCode } from './updates.mjs'

// 开发和发行使用独立目录，与对应环境的 Go 服务保持一致。
const dataOverride = process.env.SQL_STUDIO_DATA_DIR?.trim()
const dataDirectory = dataOverride ? path.resolve(dataOverride) : path.join(app.getPath('home'), app.isPackaged ? '.sql-studio' : '.sql-studio-dev')
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
let saveCleanup
let allowQuit = false
let quitGuard
const startupAbort = new AbortController()
const developmentURL = 'http://127.0.0.1:15173'

function shutdown(afterStop = () => app.quit()) {
  quitting = true
  startupAbort.abort()
  startupScreen?.dispose()
  shutdownTask ??= (async () => {
    await startupTask?.catch(() => {})
    await Promise.all([backend?.stop(), saveCleanup?.()])
    allowQuit = true
    afterStop()
  })().catch((error) => {
    trace(`退出失败: ${error.stack ?? error.message}`)
    allowQuit = true
    app.quit()
  })
  return shutdownTask
}

const requestExit = (afterStop) => (quitGuard ? quitGuard.request(afterStop) : shutdown(afterStop))

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
  // 原生按钮透出渲染层背景，弹窗遮罩出现时也与标题栏连成一体。
  const titleBarOverlay = { color: 'rgba(0, 0, 0, 0)', height: 32 }
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
          titleBarOverlay: { ...titleBarOverlay, symbolColor: dark ? '#ffffff' : '#000000' }
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
  quitGuard = createQuitGuard({
    send: (id) => contents.send('sql-studio:prepare-quit', id),
    shutdown,
    confirmForce: async () => {
      const result = await dialog.showMessageBox(window, {
        type: 'warning',
        title: '退出 SQL Studio',
        message: '工作台没有响应，是否强制退出？',
        detail: '尚未保存的 SQL 和其他修改可能丢失，连接清理可能无法完成。',
        buttons: ['取消', '强制退出'],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      })
      return result.response === 1
    }
  })
  const exitReady = (event, ready) => {
    if (isWorkbench(event)) quitGuard.setReady(ready)
  }
  const exitReceived = (event, id) => {
    return isWorkbench(event) ? quitGuard.received(id) : false
  }
  const exitPrepared = (event, id, allowed) => {
    if (isWorkbench(event)) quitGuard.respond(id, allowed)
  }
  ipcMain.on('sql-studio:quit-ready', exitReady)
  ipcMain.handle('sql-studio:quit-received', exitReceived)
  ipcMain.on('sql-studio:quit-prepared', exitPrepared)
  window.on('close', (event) => {
    if (allowQuit) return
    event.preventDefault()
    void requestExit()
  })
  const syncTheme = (event, value) => {
    if (!isWorkbench(event) || !validTitleBarTheme(value)) return
    mainWindow?.setBackgroundColor(value.background)
    if (process.platform !== 'darwin') mainWindow?.setTitleBarOverlay({ ...titleBarOverlay, symbolColor: value.foreground })
    reportThemeReady()
  }
  ipcMain.on('sql-studio:titlebar-theme', syncTheme)
  const desktopActions = {
    'sql-studio:open-console': () => contents.openDevTools({ mode: 'detach' }),
    'sql-studio:check-updates': updates.check,
    'sql-studio:get-update-state': updates.getState,
    'sql-studio:download-update': updates.download,
    'sql-studio:open-release': updates.openRelease,
    'sql-studio:install-update': () => updates.install(requestExit)
  }
  for (const [channel, action] of Object.entries(desktopActions)) {
    ipcMain.handle(channel, async (event) => {
      if (!isWorkbench(event) || quitting) throw new Error('桌面操作不可用')
      try {
        const value = await action()
        return channel === 'sql-studio:open-console' ? value : { ok: true, value }
      } catch (error) {
        trace(`${channel}: ${error.stack ?? error.message}`)
        if (channel !== 'sql-studio:open-console') return { ok: false, errorCode: desktopUpdateErrorCode(error) }
        throw new Error('桌面操作失败')
      }
    })
  }
  const unsubscribeUpdates = updates.subscribe((state) => {
    if (!contents.isDestroyed() && isAppURL(contents.mainFrame?.url, origin)) contents.send('sql-studio:updates-changed', state)
  })
  const saves = createSQLSaves((options) => dialog.showSaveDialog(window, options))
  ipcMain.handle('sql-studio:write-clipboard-text', createClipboardWriter((text) => clipboard.writeText(text), (event) => isWorkbench(event) && !quitting))
  saveCleanup = () => saves.reset()
  const saveActions = {
    'sql-studio:save-begin': saves.begin,
    'sql-studio:save-append': saves.append,
    'sql-studio:save-commit': saves.commit,
    'sql-studio:save-discard': saves.discard
  }
  for (const [channel, action] of Object.entries(saveActions)) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!isWorkbench(event) || quitting) throw new Error('桌面操作不可用')
      try {
        return await action(...args)
      } catch (error) {
        trace(`${channel}: ${error.stack ?? error.message}`)
        throw new Error('桌面操作失败')
      }
    })
  }
  const resetSaves = () => void saves.reset()
  contents.on('did-start-navigation', ({ isMainFrame, isSameDocument }) => {
    if (isMainFrame && !isSameDocument) {
      quitGuard.reset()
      resetSaves()
    }
  })
  contents.on('render-process-gone', () => {
    quitGuard.reset()
    resetSaves()
  })
  contents.once('destroyed', () => {
    ipcMain.removeListener('sql-studio:titlebar-theme', syncTheme)
    ipcMain.removeListener('sql-studio:quit-ready', exitReady)
    ipcMain.removeHandler('sql-studio:quit-received')
    ipcMain.removeListener('sql-studio:quit-prepared', exitPrepared)
    quitGuard.reset()
    for (const channel of Object.keys(desktopActions)) ipcMain.removeHandler(channel)
    for (const channel of Object.keys(saveActions)) ipcMain.removeHandler(channel)
    ipcMain.removeHandler('sql-studio:write-clipboard-text')
    unsubscribeUpdates()
    resetSaves()
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
    void requestExit()
  })
  startupTask = app
    .whenReady()
    .then(async () => {
      if (!app.isPackaged) await checkDevelopmentServices(startupAbort.signal)
      const [appearance, { icon, appIcon }] = await Promise.all([readStartupAppearance(stateDirectory, nativeTheme.shouldUseDarkColors), loadIcons()])
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
