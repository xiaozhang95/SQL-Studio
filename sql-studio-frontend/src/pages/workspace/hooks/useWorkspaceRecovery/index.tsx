import { App, Button } from 'antd'

import type { WorkspaceSnapshot } from '@/typings/workspace'
import { saveRecoveryFile } from '@/utils/recoveryFile'

type Options = { capture: (signal: AbortSignal) => Promise<WorkspaceSnapshot>; histories: unknown; blocked: boolean }

/** Recovery is explicit: export unsaved content first, then let the user reload. */
export function useWorkspaceRecovery({ capture, histories, blocked }: Options) {
  const { modal } = App.useApp()
  return () => {
    const explanation = '保存失败时，当前编辑内容仍留在页面内。重新载入会读取本机最新版本，并放弃未保存内容。建议先导出恢复副本；副本包含全部 SQL 草稿、当前已加载结果和执行历史，可人工取回内容。'
    if (blocked) {
      modal.info({ title: '请先完成当前操作', content: '请先取消执行、保存或放弃表格及设计修改，并关闭其他弹窗，再恢复配置保存。' })
      return
    }
    const controller = new AbortController()
    let exporting = false
    let closed = false
    const dialog = modal.confirm({
      title: '恢复本机配置保存',
      content: explanation,
      okText: '重新载入',
      cancelText: '继续编辑',
      autoFocusButton: 'cancel',
      okButtonProps: { danger: true },
      onCancel: () => {
        closed = true
        controller.abort()
      },
      onOk: () => {
        closed = true
        controller.abort()
        window.location.reload()
      },
      footer: (_, { OkBtn, CancelBtn }) => (
        <>
          <CancelBtn />
          <Button
            disabled={exporting}
            onClick={async () => {
              if (exporting || closed) return
              exporting = true
              dialog.update({ okButtonProps: { danger: true, disabled: true } })
              try {
                const workspace = await capture(controller.signal)
                controller.signal.throwIfAborted()
                const detail = await saveRecoveryFile({ version: 1, capturedAt: new Date().toISOString(), workspace, histories })
                if (!closed) dialog.update({ content: <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{explanation + '\n\n' + detail}</div> })
              } catch (error) {
                const cancelled = (error instanceof Error || error instanceof DOMException) && error.name === 'AbortError'
                const detail = cancelled ? '已取消导出，当前草稿和结果已保留。' : error instanceof Error ? error.message : '导出未完成，页面内容已保留。'
                if (!closed)
                  dialog.update({
                    content: <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{explanation + '\n\n' + detail}</div>
                  })
              } finally {
                exporting = false
                if (!closed) dialog.update({ okButtonProps: { danger: true, disabled: false } })
              }
            }}
          >
            导出恢复副本
          </Button>
          <OkBtn />
        </>
      )
    })
  }
}
