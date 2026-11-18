import { App as AntApp, Button } from 'antd'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { flushSync } from 'react-dom'

import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'
import type { WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'
import { saveSQL } from '@/utils/sqlSave'

import { scopeCloseDialogLayout } from '../../constant/layout'
import { runDesktopExit } from '../../utils/desktopExit'
import type { ExitDecision } from '../../utils/desktopExit'

interface Options {
  ready: boolean
  blocked: boolean
  connectionError: string
  snapshot: WorkspaceSnapshot
  connections: readonly Connection[]
  dirty: Readonly<Record<string, boolean>>
  flushEditor: () => void
  draftsFor: (pages: WorkspaceTab[]) => Promise<WorkspaceTab[]>
  setClosing: (closing: boolean) => void
  stop: () => void
  running: () => boolean
  persist: (snapshot: WorkspaceSnapshot) => Promise<void>
  closeConnection: (id: string) => Promise<void>
  clearWorkspace: (snapshot: WorkspaceSnapshot) => void
}

/** Only the desktop bridge registers this hook; browsers keep their existing unload behavior. */
export function useDesktopExit(options: Options) {
  const { modal } = AntApp.useApp()
  const { t } = useTranslation()
  const latest = useRef({ options, modal, t })
  useLayoutEffect(() => {
    latest.current = { options, modal, t }
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
          flushEditor: () => flushSync(() => current().flushEditor()),
          draftsFor: async (pages) => {
            const loading = modal.info({ title: t('正在检查工作区…'), footer: null, closable: false, keyboard: false, mask: { closable: false } })
            try {
              return await current().draftsFor(pages)
            } finally {
              loading.destroy()
            }
          },
          decide: async (_sql, queries) => {
            const dirty = current().snapshot.tabs.filter((page) => current().dirty[page.id])
            const running = current().running()
            if (!queries.length && !dirty.length && !running) return 'exit'
            return new Promise<ExitDecision>((resolve) => {
              const dialog = modal.confirm({
                width: scopeCloseDialogLayout.width,
                title: t('退出 SQL Studio？'),
                content: (
                  <>
                    {queries.length > 0 && (
                      <p style={{ overflowWrap: 'anywhere' }}>
                        {t('退出前是否保存这些 SQL 查询？')}
                        {queries.map((page) => page.title).join('、')}
                      </p>
                    )}
                    {queries.length > 0 && <p>{t('退出将关闭全部标签；未保存为文件的 SQL 不会在下次启动时恢复。')}</p>}
                    {dirty.length > 0 && (
                      <p style={{ overflowWrap: 'anywhere' }}>
                        {dirty.map((page) => page.title).join('、')}
                        {t(' 的表结构或数据修改尚未提交，退出将放弃这些修改。')}
                      </p>
                    )}
                    {running && <p>{t('退出会取消正在执行的请求；已执行的数据库操作不会因此回滚。')}</p>}
                    <p>{t('确认后将关闭全部标签和连接并退出应用。')}</p>
                  </>
                ),
                okText: queries.length ? t('保存 SQL 并退出') : t('退出'),
                cancelText: t('取消'),
                onOk: () => resolve(queries.length ? 'save' : 'exit'),
                onCancel: () => resolve('cancel'),
                footer: (_, { OkBtn, CancelBtn }) => (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                    <CancelBtn />
                    {queries.length > 0 && (
                      <Button
                        onClick={() => {
                          resolve('exit')
                          dialog.destroy()
                        }}
                      >
                        {t('不保存并退出')}
                      </Button>
                    )}
                    <OkBtn />
                  </div>
                )
              })
            })
          },
          exportSQL: (sql) => saveSQL(sql, t('SQL Studio 查询')),
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
          clearWorkspace: (value) => flushSync(() => current().clearWorkspace(value))
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
