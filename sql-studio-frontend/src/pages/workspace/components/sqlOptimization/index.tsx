import { Alert, Modal, Spin, Typography } from 'antd'

import type { ThemeMode } from '@/typings/theme'

import type { useAISQL } from '../../hooks/useAISQL'
import SQLPreview from '../sqlPreview'

export default function SQLOptimization({ model, themeMode }: { model: ReturnType<typeof useAISQL>; themeMode: ThemeMode }) {
  return (
    <Modal
      title="优化建议"
      open={model.open}
      onCancel={model.close}
      onOk={model.apply}
      okText="应用到编辑器"
      cancelText={model.loading ? '取消请求' : '关闭'}
      okButtonProps={{ disabled: !model.preview || model.loading }}
      width={1040}
      styles={{ body: { maxHeight: 'calc(100vh - 240px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      {model.error && <Alert type="error" title={model.error} style={{ marginBottom: 12 }} />}
      {model.loading && (
        <Spin description="正在生成建议…">
          <div style={{ minHeight: 100 }} />
        </Spin>
      )}
      {model.preview && (
        <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, minWidth: 0 }}>
            <SQLPreview title="原文" panel sql={model.preview.original} themeMode={themeMode} />
            <SQLPreview title="优化结果" panel sql={model.preview.result.sql || ''} themeMode={themeMode} />
          </div>
          {model.preview.result.explanation && (
            <section style={{ display: 'grid', gap: 8, minWidth: 0 }}>
              <Typography.Text strong>调整说明</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minWidth: 0, marginBottom: 0 }}>
                {model.preview.result.explanation}
              </Typography.Paragraph>
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}
