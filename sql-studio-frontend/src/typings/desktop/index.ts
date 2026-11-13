/** Electron 仅暴露受限的桌面能力。 */
export interface DesktopTitleBarTheme {
  background: string
  foreground: string
  mode: 'light' | 'dark'
}

export interface DesktopBridge {
  readonly titleBarHeight: number
  setTitleBarTheme: (value: DesktopTitleBarTheme) => void
  saveFile: {
    begin: (filename: string, filterName: string) => Promise<{ canceled: true } | { canceled: false; id: string; filePath: string }>
    append: (id: string, bytes: Uint8Array) => Promise<void>
    commit: (id: string) => Promise<void>
    discard: (id: string) => Promise<void>
  }
  readonly updates: DesktopUpdates
}

export type DesktopUpdateStatus = { status: 'upToDate' } | { status: 'available'; version: string; canDownload: boolean } | { status: 'downloaded'; version: string }

export interface DesktopUpdates {
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
