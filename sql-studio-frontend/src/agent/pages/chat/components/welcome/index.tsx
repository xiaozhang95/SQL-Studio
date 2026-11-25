import { DatabaseOutlined, SearchOutlined, TableOutlined } from '@ant-design/icons'
import { Card, Flex, Space, theme, Typography } from 'antd'

import { useTranslation } from '@/hooks/useTranslation'

const examples = [
  { title: '发现数据库', question: '查看我保存了哪些数据库连接', icon: <DatabaseOutlined /> },
  { title: '了解表结构', question: '这个库有哪些表？字段分别是什么？', icon: <TableOutlined /> },
  { title: '查询与分析', question: '按月份统计订单数量和金额', icon: <SearchOutlined /> }
]

export function Welcome() {
  const { t } = useTranslation()
  const { token } = theme.useToken()

  return (
    <Flex vertical align="center" gap="large" style={{ width: '100%', maxWidth: 720, margin: '0 auto' }}>
      <Space orientation="vertical" align="center" size="small" style={{ textAlign: 'center' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('想了解哪些数据？')}
        </Typography.Title>
        <Typography.Text type="secondary">{t('从连接、表结构到数据分析，直接描述你想了解的内容。')}</Typography.Text>
      </Space>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 175px), 1fr))', gap: token.marginSM, width: '100%' }}>
        {examples.map((example) => (
          <Card key={example.title} size="small">
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: token.controlHeightSM,
                height: token.controlHeightSM,
                borderRadius: token.borderRadius,
                background: 'var(--primary-soft)',
                color: 'var(--primary-foreground)'
              }}
            >
              {example.icon}
            </span>
            <Typography.Text strong style={{ display: 'block', marginTop: 11 }}>
              {t(example.title)}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 3 }}>
              {t(example.question)}
            </Typography.Text>
          </Card>
        ))}
      </div>
      <Typography.Text type="secondary">{t('在下方输入问题，涉及数据或结构修改时会逐次请求确认。')}</Typography.Text>
    </Flex>
  )
}
