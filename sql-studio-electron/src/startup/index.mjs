import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { nativeImage, nativeTheme, WebContentsView } from 'electron'

/** 本地启动层不依赖 HTTP 服务，工作台在它下面加载，避免导航时的白屏。 */
export async function createStartupScreen(window, { icon, dark, followSystem = false }) {
  const view = new WebContentsView({
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  })
  let disposed = false
  let shownAt
  const lifetime = new AbortController()
  const updateSystemTheme = () => {
    if (!disposed && followSystem && !view.webContents.isDestroyed())
      view.webContents.send('sql-studio:startup-theme', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  }
  const resize = () => {
    if (disposed || window.isDestroyed()) return
    const [width, height] = window.getContentSize()
    view.setBounds({ x: 0, y: 0, width, height })
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    lifetime.abort()
    nativeTheme.removeListener('updated', updateSystemTheme)
    window.removeListener('resize', resize)
    window.removeListener('closed', dispose)
    if (!window.isDestroyed()) window.contentView.removeChildView(view)
    if (!view.webContents.isDestroyed()) view.webContents.close()
  }
  const setStage = (stage) => {
    if (!disposed && !view.webContents.isDestroyed()) view.webContents.send('sql-studio:startup-stage', stage)
  }
  // 页面自身绘制背景；视图透明使淡出能露出下面已加载的工作台。
  view.setBackgroundColor('#00000000')
  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  view.webContents.on('will-navigate', (event) => event.preventDefault())
  view.webContents.on('will-attach-webview', (event) => event.preventDefault())
  window.contentView.addChildView(view)
  window.on('resize', resize)
  window.once('closed', dispose)
  resize()
  try {
    await view.webContents.loadFile(fileURLToPath(new URL('./index.html', import.meta.url)), {
      query: { theme: dark ? 'dark' : 'light', icon: nativeImage.createFromPath(icon).toDataURL() }
    })
    if (!window.isDestroyed()) {
      window.show()
      shownAt = performance.now()
      nativeTheme.on('updated', updateSystemTheme)
      updateSystemTheme()
    }
  } catch (error) {
    dispose()
    throw error
  }
  return {
    setStage,
    dispose,
    async complete() {
      // 两秒从开屏实际显示起计时，后台初始化并行进行；慢启动不再额外等两秒。
      await delay(Math.max(0, 2000 - (performance.now() - shownAt)), undefined, { signal: lifetime.signal })
      setStage('ready')
      await delay(240, undefined, { signal: lifetime.signal })
      dispose()
    }
  }
}
