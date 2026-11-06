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
      // 工作台就绪后保留两秒，让品牌和加载动画充分展示。
      await delay(2000, undefined, { signal: lifetime.signal })
      setStage('ready')
      await delay(240, undefined, { signal: lifetime.signal })
      dispose()
    }
  }
}
