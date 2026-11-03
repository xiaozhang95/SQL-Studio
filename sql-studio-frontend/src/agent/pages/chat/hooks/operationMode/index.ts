import { App } from 'antd'

import type { WorkspaceController } from '../../../../hooks/workspace'

export function useOperationMode(workspace: WorkspaceController) {
  const mode = workspace.state.mode ?? 'readonly'
  const { modal } = App.useApp()
  function change(next: 'readonly' | 'write') {
    if (!workspace.ready || next === mode) return
    modal.confirm({
      title: next === 'write' ? '切换为完全访问模式？' : '切换为只读模式？',
      content: next === 'write' ? 'AI可查询、新增、修改数据并创建或调整数据库结构，操作可能不可撤销。删除、清空及删表始终禁止执行，仅提供命令与风险提示。' : '后续提问只允许读取；已执行修改不会撤销。',
      okText: '确认切换',
      cancelText: '取消',
      onOk: () => workspace.update({ mode: next })
    })
  }
  return { mode, change }
}
