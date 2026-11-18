/** Electron 仅暴露受限的桌面能力。 */
export interface DesktopTitleBarTheme {
  background: string
  foreground: string
  mode: 'light' | 'dark'
}

export interface DesktopBridge {
  readonly platform: 'win32' | 'darwin' | 'linux'
  readonly titleBarHeight: number
  setTitleBarTheme: (value: DesktopTitleBarTheme) => void
  openConsole: () => Promise<void>
  writeClipboardText: (text: string) => Promise<boolean>
  onBeforeQuit: (handler: () => Promise<boolean>) => () => void
  saveFile: {
    begin: (filename: string, filterName: string) => Promise<{ canceled: true } | { canceled: false; id: string; filePath: string }>
    append: (id: string, bytes: Uint8Array) => Promise<void>
    commit: (id: string) => Promise<void>
    discard: (id: string) => Promise<void>
  }
  readonly updates: DesktopUpdates
}

export type DesktopUpdateStatus = { status: 'upToDate' } | { status: 'available'; version: string; canDownload: boolean } | { status: 'downloaded'; version: string }

export interface DesktopUpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface DesktopUpdateState {
  revision: number
  result?: DesktopUpdateStatus
  pending?: 'check' | 'download'
  progress?: DesktopUpdateProgress
  error?: { action: 'check' | 'download'; code: DesktopUpdateErrorCode }
}

export type DesktopUpdateErrorCode =
  | 'UPDATE_RATE_LIMITED'
  | 'UPDATE_FORBIDDEN'
  | 'UPDATE_NO_RELEASE'
  | 'UPDATE_TIMEOUT'
  | 'UPDATE_NETWORK'
  | 'UPDATE_SERVER_ERROR'
  | 'UPDATE_INVALID_RESPONSE'
  | 'UPDATE_MANIFEST_MISMATCH'
  | 'UPDATE_FAILED'

export interface DesktopUpdates {
  getState: () => Promise<DesktopUpdateState>
  onState: (handler: (state: DesktopUpdateState) => void) => () => void
  check: () => Promise<DesktopUpdateStatus>
  download: () => Promise<Extract<DesktopUpdateStatus, { status: 'downloaded' }>>
  openRelease: () => Promise<void>
  install: () => Promise<void>
}

declare global {
  interface Window {
    sqlStudioDesktop?: DesktopBridge
  }
}
