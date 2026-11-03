import { Alert, App, Flex, theme, Typography } from 'antd'

import type { WorkspaceController } from '../../../../hooks/workspace'
import { CHAT } from '../../constant/chat'

export function useOperationMode(workspace: WorkspaceController) {
  const mode = workspace.state.mode ?? 'readonly'
  const { modal } = App.useApp()
  const { token } = theme.useToken()
  function change(next: 'readonly' | 'write') {
    if (!workspace.ready || next === mode) return
    const write = next === 'write'
    modal.confirm({
      title: write ? '切换为完全访问模式？' : '切换为只读模式？',
      width: CHAT.modeConfirmationWidth,
      centered: true,
      styles: { container: { borderColor: write ? token.colorWarning : token.colorBorder } },
      content: write ? (
        <Flex vertical gap="middle" style={{ paddingTop: token.paddingXS }}>
          <Alert type="warning" showIcon title="将实际修改数据库，操作可能不可撤销" description="请在执行前核对目标数据库、涉及对象和完整 SQL。" />
          <div>
            <Typography.Paragraph style={{ marginBottom: token.marginXS }}>
              <Typography.Text strong>允许的操作：</Typography.Text>查询、新增、修改数据，以及创建或调整数据库结构。
            </Typography.Paragraph>
            <Typography.Paragraph style={{ marginBottom: token.marginXS }}>
              <Typography.Text strong>执行前确认：</Typography.Text>每次写入仍需在回复下方的卡片中单独确认，切换模式不会自动执行 SQL。
            </Typography.Paragraph>
            <Typography.Paragraph style={{ margin: 0 }}>
              <Typography.Text type="danger" strong>
                始终禁止删除、清空数据和删表。
              </Typography.Text>
              此类请求仅提供命令及风险提示。
            </Typography.Paragraph>
          </div>
        </Flex>
      ) : (
        <Alert type="info" showIcon title="后续提问只允许读取数据库" description="已经执行的修改不会因切回只读模式而撤销。" />
      ),
      okText: write ? '切换到完全访问模式' : '切换到只读模式',
      okButtonProps: { danger: write },
      cancelText: '取消',
      onOk: () => workspace.update({ mode: next })
    })
  }
  return { mode, change }
}
