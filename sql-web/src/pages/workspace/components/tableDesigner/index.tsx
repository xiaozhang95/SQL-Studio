import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { Alert, Button, Space, Spin, Typography } from 'antd'

import type { ThemeMode } from '@/typings/theme'

import { useTableDesigner } from '../../hooks/useTableDesigner'
import type { TableDesignerOptions } from '../../hooks/useTableDesigner'
import ObjectManagementForm from '../objectManagementForm'

type Props = TableDesignerOptions & { themeMode: ThemeMode; available: boolean }
export default function TableDesigner({ themeMode, available, ...options }: Props) {
  const manager = useTableDesigner(options)
  const connection = options.connections.find((value) => value.id === options.page.connectionId)
  return (
    <section className="workspace-page" aria-label="表设计工作区">
      <div className="editor-toolbar">
        <Space wrap>
          <Button type="primary" icon={<SaveOutlined />} loading={manager.saving} disabled={!manager.ready || manager.loading || options.blocked} onClick={manager.save}>
            保存
          </Button>
          <Button disabled={!manager.ready || manager.loading || manager.saving || options.blocked} onClick={manager.preview}>
            预览 SQL
          </Button>
          <Button icon={<ReloadOutlined />} disabled={manager.loading || manager.saving || options.blocked} onClick={manager.reload}>
            重新加载
          </Button>
        </Space>
        <Typography.Text type="secondary">
          {connection?.name || manager.dialog?.connection.name || '连接不可用'} / {options.page.database}
          {options.page.table ? ' / ' + options.page.table : ''}
          {manager.dirty ? ' · 未保存' : ''}
        </Typography.Text>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12 }}>
        {!available && <Alert type="warning" showIcon title="连接未打开，请重新打开连接后保存。" style={{ marginBottom: 12 }} />}
        <Spin spinning={manager.loading}>
          <ObjectManagementForm manager={manager} themeMode={themeMode} showScope={false} />
        </Spin>
      </div>
    </section>
  )
}
