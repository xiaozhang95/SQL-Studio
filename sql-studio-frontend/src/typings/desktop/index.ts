/** Electron 只暴露标题栏主题能力，不向页面提供通用 IPC 或 Node API。 */
export interface DesktopTitleBarTheme {
  background: string
  foreground: string
  mode: 'light' | 'dark'
}

export interface DesktopBridge {
  readonly titleBarHeight: number
  setTitleBarTheme: (value: DesktopTitleBarTheme) => void
}

declare global {
  interface Window {
    sqlStudioDesktop?: DesktopBridge
  }
}
