import { ReloadOutlined } from '@ant-design/icons'
import { Button, Flex, Progress, theme, Tooltip } from 'antd'

import { appearance, railButtonStyle } from '@/constant/appearance'
import type { DesktopUpdatesModel } from '@/hooks/useDesktopUpdates'
import { useTranslation } from '@/hooks/useTranslation'

interface Props {
  updates: DesktopUpdatesModel
  disabled: boolean
}

export default function UpdateIndicator({ updates, disabled }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const { desktop, downloadStatus, error, pending, progress, result, run } = updates
  if (!desktop) return null

  if (pending === 'download') {
    const label = t(downloadStatus)
    return (
      <Tooltip title={label} placement="right">
        <Flex align="center" justify="center" style={{ width: railButtonStyle.width, height: railButtonStyle.height, flex: 'none' }}>
          <Progress
            type="circle"
            size={token.controlHeight}
            percent={Math.floor(progress?.percent ?? 0)}
            showInfo={false}
            status="active"
            strokeColor={token.colorPrimary}
            railColor={token.colorBorder}
            aria-label={t('更新下载进度')}
            aria-valuetext={label}
          />
        </Flex>
      </Tooltip>
    )
  }

  if (result?.status !== 'downloaded') return null
  const installLabel = t('重启并安装')
  const tooltip = error ? `${t(error)} · ${installLabel}` : `${t('已下载版本 {version}', { version: result.version })} · ${installLabel}`
  return (
    <Tooltip title={tooltip} placement="right" trigger={['hover', 'focus']}>
      <Button
        type="text"
        className="app-rail-button"
        style={{ ...railButtonStyle, color: token.colorPrimary }}
        icon={<ReloadOutlined aria-hidden="true" style={{ fontSize: appearance.railIconSize }} />}
        aria-label={installLabel}
        loading={pending === 'install'}
        disabled={disabled || Boolean(pending)}
        onClick={() => void run('install')}
      />
    </Tooltip>
  )
}
