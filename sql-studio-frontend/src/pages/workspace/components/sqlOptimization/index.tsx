import { Modal, Typography } from 'antd'

import ContentLoading from '@/components/contentLoading'
import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'

import type { useAISQL } from '../../hooks/useAISQL'
import SQLPreview from '../sqlPreview'

export default function SQLOptimization({ model, themeMode }: { model: ReturnType<typeof useAISQL>; themeMode: ThemeMode }) {
  const { t } = useTranslation()

  return (
    <Modal
      title={t('SQL 美化建议')}
      open={model.open}
      onCancel={model.close}
      onOk={model.apply}
      okText={t('应用到编辑器')}
      cancelText={model.loading ? t('取消请求') : t('关闭')}
      okButtonProps={{ disabled: !model.preview || model.loading }}
      width={1040}
      styles={{ body: { maxHeight: 'calc(100vh - 240px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <ErrorNotice error={model.error} style={{ marginBottom: 12 }} />
      {model.loading && <ContentLoading label={t('正在生成建议…')} style={{ minHeight: 100 }} />}
      {model.preview && (
        <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, minWidth: 0 }}>
            <SQLPreview title={t('原文')} panel sql={model.preview.original} themeMode={themeMode} />
            <SQLPreview title={t('调整结果')} panel sql={model.preview.result.sql || ''} themeMode={themeMode} />
          </div>
          {model.preview.result.explanation && (
            <section style={{ display: 'grid', gap: 8, minWidth: 0 }}>
              <Typography.Text strong>{t('调整说明')}</Typography.Text>
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
