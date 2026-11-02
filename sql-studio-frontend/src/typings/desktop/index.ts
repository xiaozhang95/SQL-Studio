export interface DesktopBridge {
  onBeforeClose(callback: () => Promise<void>): () => void
}

declare global {
  interface Window {
    sqlStudioDesktop?: DesktopBridge
  }
}
