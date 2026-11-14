import { Checkbox, Form, Input, InputNumber, Select } from 'antd'

import type { DatabaseProfile } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { ExternalDatabase } from '@/services/databaseSync'

type Props = {
  side: 'source' | 'target'
  profile: DatabaseProfile
  options: { label: string; value: string }[]
  value: string
  externalID: string
  credentials: ExternalDatabase
  onChange: (value: string) => void
  onCredentials: (patch: Partial<ExternalDatabase>) => void
}

export default function DatabaseSyncConnection({ side, profile, options, value, externalID, credentials, onChange, onCredentials }: Props) {
  const { t } = useTranslation()
  const field = `sync-${side}`
  return (
    <>
      <Form.Item label={t(side === 'source' ? '源连接' : '目标连接')} htmlFor={field}>
        <Select
          id={field}
          value={value || undefined}
          options={[{ value: externalID, label: t('外部连接') }, ...options]}
          showSearch={{ optionFilterProp: 'label' }}
          placeholder={t('选择已保存或外部连接')}
          onChange={onChange}
        />
      </Form.Item>
      {value === externalID && (
        <>
          <Form.Item label={t(side === 'source' ? '源主机' : '目标主机')} htmlFor={field + '-host'}>
            <Input
              id={field + '-host'}
              autoComplete="off"
              value={credentials.host}
              spellCheck={false}
              maxLength={255}
              placeholder={t('主机名或 IP 地址')}
              onChange={(event) => onCredentials({ host: event.target.value })}
            />
          </Form.Item>
          <Form.Item label={t(side === 'source' ? '源端口' : '目标端口')} htmlFor={field + '-port'}>
            <InputNumber
              id={field + '-port'}
              min={1}
              max={65535}
              precision={0}
              placeholder={String(profile.port)}
              style={{ width: '100%' }}
              value={credentials.port || null}
              onChange={(port) => onCredentials({ port: port ?? 0 })}
            />
          </Form.Item>
          <Form.Item label={t(side === 'source' ? '源用户名' : '目标用户名')} htmlFor={field + '-user'}>
            <Input
              id={field + '-user'}
              autoComplete="off"
              value={credentials.username}
              maxLength={256}
              placeholder={t(profile.optionalUsername ? '未启用认证时可留空' : '输入数据库用户名')}
              onChange={(event) => onCredentials({ username: event.target.value })}
            />
          </Form.Item>
          <Form.Item label={t(side === 'source' ? '源密码' : '目标密码')} htmlFor={field + '-password'}>
            <Input.Password
              id={field + '-password'}
              autoComplete="new-password"
              value={credentials.password}
              placeholder={t('输入数据库密码，可留空')}
              onChange={(event) => onCredentials({ password: event.target.value })}
            />
          </Form.Item>
          {profile.database && (
            <Form.Item label={t('维护数据库')} htmlFor={field + '-maintenance'}>
              <Input
                id={field + '-maintenance'}
                autoComplete="off"
                value={credentials.database ?? ''}
                placeholder={t('留空使用 {database}', { database: profile.database })}
                onChange={(event) => onCredentials({ database: event.target.value })}
              />
            </Form.Item>
          )}
          <Form.Item label="TLS">
            <Checkbox checked={credentials.tls} onChange={(event) => onCredentials({ tls: event.target.checked })}>
              {t('验证服务器证书')}
            </Checkbox>
          </Form.Item>
        </>
      )}
    </>
  )
}
