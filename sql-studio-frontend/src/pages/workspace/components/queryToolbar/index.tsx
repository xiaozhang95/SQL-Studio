import { Flex, theme } from 'antd'
import type { ReactNode } from 'react'

import { panelHeaderRowStyle } from '@/constant/appearance'

import { workspaceInset } from '../../constant/layout'
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
      wrap
      style={{
        ...panelHeaderRowStyle,
        flex: 'none',
        paddingInline: workspaceInset,
        paddingBlock: token.paddingXXS,
        columnGap: token.marginXS,
        rowGap: token.marginXXS,
        background: token.colorBgContainer,
        userSelect: 'none'
      }}
    >
      <ScopeSelects
        scope={tab}
        connections={savedConnections}
        objects={objects}
        disabled={disabled}
        compact={compact}
        onConnection={selectConnection}
        onSelect={selectObject}
        onSchema={(schema) => selectObject(tab.database, undefined, tab.connectionId, schema)}
      />
      {(runActions || children) && (
        <Flex align="center" gap={token.marginXXS} wrap style={{ flex: '1 1 auto', minWidth: 0 }}>
          {runActions && (
            <Flex align="center" gap={token.marginXXS} wrap>
              {runActions}
            </Flex>
          )}
          {children && (
            <Flex align="center" gap={token.marginXXS} justify="flex-end" wrap style={{ marginInlineStart: 'auto', minWidth: 0 }}>
              {children}
            </Flex>
          )}
        </Flex>
      )}
    </Flex>
  )
}
