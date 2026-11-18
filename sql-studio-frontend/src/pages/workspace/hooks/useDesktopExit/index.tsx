import { QuestionCircleOutlined } from '@ant-design/icons'
import { App as AntApp, Button } from 'antd'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { flushSync } from 'react-dom'

import { useAppSection } from '@/hooks/useAppSection'
import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'
import type { WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'
import { saveSQL } from '@/utils/sqlSave'

import { runDesktopExit } from '../../utils/desktopExit'
import type { ExitDecision } from '../../utils/desktopExit'

interface Options {
  ready: boolean
  blocked: boolean
  connectionError: string
  snapshot: WorkspaceSnapshot
  connections: readonly Connection[]
  dirty: Readonly<Record<string, boolean>>
  pageReady: boolean
  pageLoadFailed: boolean
  flushEditor: () => void
  draftsFor: (pages: WorkspaceTab[]) => Promise<WorkspaceTab[]>
  activatePage: (id: string) => void
  setPreparing: (preparing: boolean) => void
  setClosing: (closing: boolean) => void
  stop: () => void
  running: () => boolean
  persist: (snapshot: WorkspaceSnapshot) => Promise<void>
  closeConnection: (id: string) => Promise<void>
  applyWorkspace: (snapshot: WorkspaceSnapshot) => void
}

/** Only the desktop bridge registers this hook; browsers keep their existing unload behavior. */
export function useDesktopExit(options: Options) {
  const { modal } = AntApp.useApp()
  const { t } = useTranslation()
  const { openWorkspace } = useAppSection()
  const latest = useRef({ options, modal, t, openWorkspace })
  useLayoutEffect(() => {
    latest.current = { options, modal, t, openWorkspace }
  })
  useEffect(() => {
    const desktop = window.sqlStudioDesktop
    if (!desktop?.onBeforeQuit) return
    let pending: Promise<boolean> | undefined
    async function prepare() {
      const { modal, t } = latest.current
      const current = () => latest.current.options
      try {
        if (!current().ready || current().blocked) throw new Error(t('请等待当前操作或工作区恢复完成后再退出'))
        if (current().connectionError) throw new Error(current().connectionError)
        return await runDesktopExit({
          snapshot: () => current().snapshot,
          connections: () => current().connections,
          isDirty: (id) => Boolean(current().dirty[id]),
          flushEditor: () => flushSync(() => current().flushEditor()),
          draftsFor: (pages) => current().draftsFor(pages),
          activatePage: async (id) => {
            flushSync(() => {
              latest.current.openWorkspace()
              current().activatePage(id)
            })
            const deadline = Date.now() + 10000
            while (current().snapshot.activeTab !== id || !current().pageReady) {
              if (current().pageLoadFailed || Date.now() >= deadline) throw new Error(t('查询内容读取失败'))
              await new Promise<void>((resolve) => window.setTimeout(resolve, 20))
            }
          },
          decide: async (page) => {
            const hasSQL = page.kind === 'query' && Boolean(page.sql.trim())
            const dirty = current().dirty[page.id]
            const running = current().snapshot.runningTabId === page.id && current().running()
            if (!hasSQL && !dirty && !running) return 'exit'
            return new Promise<ExitDecision>((resolve) => {
              let decision: ExitDecision = 'cancel'
              const dialog = modal.confirm({
                centered: true,
                title: t('确认'),
                icon: <QuestionCircleOutlined />,
                content: (
                  <div style={{ display: 'grid', gap: 8, overflowWrap: 'anywhere' }}>
                    <div>{hasSQL ? t('是否保存对「{value1}」的更改？', { value1: page.title }) : t('是否关闭「{value1}」？', { value1: page.title })}</div>
                    {dirty && <div>{t('未提交的表结构或数据修改将被放弃。')}</div>}
                    {running && <div>{t('正在执行的请求将被取消。')}</div>}
                  </div>
                ),
                okText: hasSQL ? t('保存') : t('关闭'),
                cancelText: t('取消'),
                onOk: () => {
                  decision = hasSQL ? 'save' : 'exit'
                },
                onCancel: () => {
                  decision = 'cancel'
                },
                afterClose: () => resolve(decision),
                footer: (_, { OkBtn, CancelBtn }) => (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                    <CancelBtn />
                    {hasSQL && (
                      <Button
                        onClick={() => {
                          decision = 'exit'
                          dialog.destroy()
                        }}
                      >
                        {t('不保存')}
                      </Button>
                    )}
                    <OkBtn />
                  </div>
                )
              })
            })
          },
          exportSQL: (sql, title) => saveSQL(sql, title),
          setPreparing: (preparing) => flushSync(() => current().setPreparing(preparing)),
          setClosing: (closing) => flushSync(() => current().setClosing(closing)),
          stop: () => current().stop(),
          waitForIdle: async () => {
            const deadline = Date.now() + 10000
            while (current().running()) {
              if (Date.now() >= deadline) throw new Error(t('请求尚未结束，请稍后重试退出'))
              await new Promise<void>((resolve) => window.setTimeout(resolve, 20))
            }
          },
          persist: (value) => current().persist(value),
          closeConnection: (id) => current().closeConnection(id),
          applyWorkspace: (value) => flushSync(() => current().applyWorkspace(value))
        })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          modal.error({
            title: t('退出失败，窗口已保留'),
            content: <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{error instanceof Error ? t(error.message) : t('请重试退出')}</div>
          })
        return false
      }
    }
    return desktop.onBeforeQuit(() => {
      pending ??= prepare().finally(() => {
        pending = undefined
      })
      return pending
    })
  }, [])
}
