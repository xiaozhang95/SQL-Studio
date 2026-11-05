import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { Alert, Button, Space, Spin, Typography } from 'antd'

import type { ThemeMode } from '@/typings/theme'

import { useTableDesigner } from '../../hooks/useTableDesigner'
import type { TableDesignerOptions } from '../../hooks/useTableDesigner'
import ObjectManagementForm from '../objectManagementForm'

type Props = TableDesignerOptions & {
  themeMode: ThemeMode
  available: boolean
}
export default function TableDesigner({ themeMode, available, ...options }: Props) {
  const manager = useTableDesigner(options)
  return (
    <section className="workspace-page" aria-label="表设计工作区" style={{ height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div
        className="editor-toolbar"
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          padding: 'var(--workspace-inset)',
          borderBottom: '1px solid var(--border)',
          userSelect: 'none'
        }}
      >
        <Space wrap>
          <Button type="primary" icon={<SaveOutlined />} loading={manager.saving} disabled={!manager.ready || manager.loading || options.blocked} onClick={manager.save}>
            保存
          </Button>
          <Button disabled={!manager.ready || manager.loading || manager.saving || options.blocked} onClick={manager.preview}>
            预览
          </Button>
          <Button icon={<ReloadOutlined />} disabled={manager.loading || manager.saving || options.blocked} onClick={manager.reload}>
            重新加载
          </Button>
          {manager.dirty && <Typography.Text type="secondary">未保存</Typography.Text>}
        </Space>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12 }}>
        {!available && <Alert type="warning" showIcon title="连接未打开，请重新打开连接后保存。" style={{ marginBottom: 12 }} />}
        <Spin spinning={manager.loading}>
          <ObjectManagementForm manager={manager} themeMode={themeMode} />
        </Spin>
      </div>
    </section>
  )
}
