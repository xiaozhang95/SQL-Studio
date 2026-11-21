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
  const { tab, savedConnections, objects, selectConnection, selectObject } = model
  return (
    <div
      className="editor-toolbar"
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        minHeight: 44,
        padding: '0 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        userSelect: 'none'
      }}
    >
      <div className="toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: compact ? '1 1 308px' : '1 1 500px', minWidth: 0, flexWrap: compact ? 'nowrap' : 'wrap' }}>
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
      </div>
      {children && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', justifyContent: 'flex-end', flexWrap: 'wrap', minWidth: 0 }}>{children}</div>}
    </div>
  )
}
