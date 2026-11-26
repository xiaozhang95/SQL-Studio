import { DownloadOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons'
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
          {progress?.total ? (
            <Progress
              type="circle"
              size={token.controlHeight}
              percent={Math.floor(progress.percent)}
              showInfo={false}
              status="active"
              strokeColor={token.colorTextSecondary}
              railColor={token.colorBorder}
              aria-label={t('更新下载进度')}
              aria-valuetext={label}
            />
          ) : (
            <LoadingOutlined spin role="status" aria-label={label} style={{ fontSize: token.controlHeight }} />
          )}
        </Flex>
      </Tooltip>
    )
  }

  if (result?.status !== 'available' && result?.status !== 'downloaded') return null

  const installReady = result.status === 'downloaded'
  const action = installReady ? 'install' : result.canDownload ? 'download' : 'openRelease'
  const label = t(installReady ? '重启并安装' : result.canDownload ? '下载更新' : '手动下载')
  const ActionIcon = installReady ? ReloadOutlined : DownloadOutlined
  return (
    <Tooltip title={error ? t(error) : label} placement="right" trigger={['hover', 'focus']}>
      <Button
        type="text"
        className="app-rail-button"
        style={railButtonStyle}
        icon={<ActionIcon aria-hidden="true" style={{ fontSize: appearance.railIconSize }} />}
        aria-label={label}
        loading={pending === action}
        disabled={disabled || Boolean(pending)}
        onClick={() => void run(action)}
      />
    </Tooltip>
  )
}
