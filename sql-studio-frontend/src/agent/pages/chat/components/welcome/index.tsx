import { Space, Typography } from 'antd'

export function Welcome() {
  return (
    <Space orientation="vertical" align="center" size="small" style={{ width: '100%', textAlign: 'center' }}>
      <Typography.Text>想了解哪些数据？</Typography.Text>
      <Typography.Text type="secondary">直接问我，比如“有哪些数据库？”</Typography.Text>
    </Space>
  )
}
