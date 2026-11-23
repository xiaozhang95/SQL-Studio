import { Flex, theme } from 'antd'
import type { ReactNode } from 'react'

import type { WorkspaceModel } from '../../hooks/useWorkspace'
import ScopeSelects from '../scopeSelects'

type Props = {
  model: Pick<WorkspaceModel, 'tab' | 'savedConnections' | 'objects' | 'selectConnection' | 'selectObject'>
  disabled: boolean
  compact?: boolean
  runActions?: ReactNode
  children?: ReactNode
}

export default function QueryToolbar({ model, disabled, compact, runActions, children }: Props) {
  const { token } = theme.useToken()
  const { tab, savedConnections, objects, selectConnection, selectObject } = model
  return (
    <Flex
      className="editor-toolbar"
      align="center"
      justify="space-between"
      gap={token.marginXS}
      wrap
      style={{
        flex: 'none',
        minHeight: 44,
        paddingInline: token.padding,
        borderBlockEnd: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        userSelect: 'none'
      }}
    >
      <Flex align="center" gap="small" wrap style={{ flex: compact ? '1 1 308px' : '1 1 500px', minWidth: 0 }}>
        <ScopeSelects
          scope={tab}
          connections={savedConnections}
          objects={objects}
          disabled={disabled}
          onConnection={selectConnection}
          onSelect={selectObject}
          onSchema={(schema) => selectObject(tab.database, undefined, tab.connectionId, schema)}
        />
        {runActions}
      </Flex>
      {children && (
        <Flex align="center" gap={token.marginXXS} justify="flex-end" wrap style={{ marginInlineStart: 'auto', minWidth: 0 }}>
          {children}
        </Flex>
      )}
    </Flex>
  )
}
