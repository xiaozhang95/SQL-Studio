import { Button, Flex, Tooltip } from 'antd'

import StudioIcon from '@/components/studioIcon'
import { appearance, railButtonStyle } from '@/constant/appearance'
import type { DesktopUpdatesModel } from '@/hooks/useDesktopUpdates'
import { useTranslation } from '@/hooks/useTranslation'

interface Props {
  updates: DesktopUpdatesModel
  disabled: boolean
}

export default function UpdateIndicator({ updates, disabled }: Props) {
  const { t } = useTranslation()
  const { desktop, downloadStatus, error, pending, progress, result, run } = updates
  if (!desktop) return null
  const size = appearance.railIconSize
  const spinner = <StudioIcon name="spinner" size={size} />

  if (pending === 'download') {
    const label = t(downloadStatus)
    const percent = Math.floor(progress?.percent ?? 0)
    return (
      <Tooltip title={label} placement="right">
        <Flex align="center" justify="center" style={{ width: railButtonStyle.width, height: railButtonStyle.height, flex: 'none' }}>
          {progress?.total ? (
            <span role="progressbar" aria-label={t('更新下载进度')} aria-valuenow={percent} aria-valuetext={`${label} ${percent}%`} style={{ display: 'flex' }}>
              <StudioIcon name="progress" size={size} progress={percent} />
            </span>
          ) : (
            <span role="status" aria-label={label} style={{ display: 'flex' }}>
              {spinner}
            </span>
          )}
        </Flex>
      </Tooltip>
    )
  }

  if (result?.status !== 'available' && result?.status !== 'downloaded') return null

  const installReady = result.status === 'downloaded'
  const action = installReady ? 'install' : result.canDownload ? 'download' : 'openRelease'
  const label = t(installReady ? '重启并安装' : result.canDownload ? '下载更新' : '手动下载')
  return (
    <Tooltip title={error ? t(error) : label} placement="right" trigger={['hover', 'focus']}>
      <Button
        type="text"
        className="app-rail-button"
        style={railButtonStyle}
        icon={<StudioIcon name={installReady ? 'restart' : 'download'} size={size} />}
        aria-label={label}
        loading={pending === action && { icon: spinner }}
        disabled={disabled || Boolean(pending)}
        onClick={() => void run(action)}
      />
    </Tooltip>
  )
}
