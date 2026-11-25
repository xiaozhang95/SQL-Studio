import { useCallback, useEffect, useRef, useState } from 'react'

import type { DesktopUpdateErrorCode, DesktopUpdateState } from '@/typings/desktop'

type UpdateAction = 'check' | 'download' | 'openRelease' | 'install'

const actionErrors = {
  check: '检查更新失败，请稍后重试。',
  download: '下载更新失败，请重试或前往 GitHub 下载。',
  openRelease: '无法打开下载页面',
  install: '无法启动更新安装'
} as const satisfies Record<UpdateAction, string>

const updateErrors = {
  UPDATE_RATE_LIMITED: 'GitHub 已限制更新请求，请稍后重试。',
  UPDATE_FORBIDDEN: 'GitHub 拒绝了更新请求（HTTP 403）。',
  UPDATE_NO_RELEASE: '未找到公开的正式发行版。',
  UPDATE_TIMEOUT: '连接更新服务器超时，请稍后重试。',
  UPDATE_NETWORK: '无法连接更新服务器，请检查代理或网络配置。',
  UPDATE_SERVER_ERROR: '更新服务器暂时不可用，请稍后重试。',
  UPDATE_INVALID_RESPONSE: '更新信息格式无效，请前往发行页面查看。',
  UPDATE_MANIFEST_MISMATCH: '更新清单与所选版本或系统架构不匹配，请前往发行页面下载。',
  UPDATE_FAILED: '更新操作失败，请稍后重试。'
} as const satisfies Record<DesktopUpdateErrorCode, string>

function isUpdateErrorCode(value: string): value is DesktopUpdateErrorCode {
  return Object.hasOwn(updateErrors, value)
}

function errorMessage(action: UpdateAction, code?: DesktopUpdateErrorCode) {
  return code && code !== 'UPDATE_FAILED' ? updateErrors[code] : actionErrors[action]
}

export function useDesktopUpdates() {
  const desktop = window.sqlStudioDesktop
  const [state, setState] = useState<DesktopUpdateState>({ revision: -1 })
  const [actionPending, setActionPending] = useState<UpdateAction>()
  const [actionError, setActionError] = useState('')
  const running = useRef(false)
  const receive = useCallback((next: DesktopUpdateState) => {
    setState((current) => (next.revision > current.revision ? next : current))
  }, [])

  useEffect(() => {
    if (!desktop) return
    let active = true
    const accept = (next: DesktopUpdateState) => {
      if (active) receive(next)
    }
    const unsubscribe = desktop.updates.onState(accept)
    void desktop.updates
      .getState()
      .then(accept)
      .catch(() => {})
    return () => {
      active = false
      unsubscribe()
    }
  }, [desktop, receive])

  async function run(action: UpdateAction) {
    if (!desktop || running.current || state.pending) return
    running.current = true
    setActionPending(action)
    setActionError('')
    try {
      await desktop.updates[action]()
    } catch (cause) {
      const code = cause instanceof Error && isUpdateErrorCode(cause.message) ? cause.message : undefined
      setActionError(errorMessage(action, code))
    } finally {
      setActionPending(undefined)
      running.current = false
    }
  }

  const pending = state.pending ?? actionPending
  const downloadFailed = state.error?.action === 'download'
  const progress = pending === 'download' && downloadFailed ? undefined : state.progress
  const downloadStatus = !progress?.total ? '正在准备下载更新' : progress.percent >= 100 ? '正在校验更新' : '正在下载更新'

  return {
    desktop: Boolean(desktop),
    result: state.result,
    progress,
    pending,
    downloadStatus,
    error: actionError || (state.error ? errorMessage(state.error.action, state.error.code) : ''),
    downloadFailed,
    run
  }
}

export type DesktopUpdatesModel = ReturnType<typeof useDesktopUpdates>
