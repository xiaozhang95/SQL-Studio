import { DownloadOutlined } from '@ant-design/icons'
import { Button, Flex, Progress, theme, Typography } from 'antd'

import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'

import { useDesktopConsole } from '../../hooks/useDesktopConsole'
import { useDesktopUpdates } from '../../hooks/useDesktopUpdates'

export default function About({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const { desktop, result, pending, progress, downloadFailed, error, run } = useDesktopUpdates()
  const desktopConsole = useDesktopConsole()
  const busy = disabled || Boolean(pending) || desktopConsole.opening
  const downloading = pending === 'download'
  const showDownloadProgress = downloading || (downloadFailed && Boolean(progress))
  const version = import.meta.env.VITE_SQL_STUDIO_VERSION
  const status = {
    upToDate: '当前已是最新版本',
    available: '发现新版本 {version}',
    downloaded: '已下载版本 {version}'
  } as const

  return (
    <Flex vertical gap="middle">
      <Flex gap="middle" align="baseline" wrap>
        <Typography.Text>{t('当前版本')}</Typography.Text>
        <Typography.Text style={{ fontVariantNumeric: 'tabular-nums' }}>{version || '—'}</Typography.Text>
      </Flex>
      {desktop && (
        <>
          <Flex gap="small" align="center" wrap>
            <Button disabled={busy && pending !== 'check'} loading={pending === 'check'} onClick={() => void run('check')}>
              {t('检查更新')}
            </Button>
            <Button disabled={busy && !desktopConsole.opening} loading={desktopConsole.opening} onClick={() => void desktopConsole.openConsole()}>
              {t('查看控制台')}
            </Button>
            {result?.status === 'available' && result.canDownload && (
              <Button
                disabled={busy}
                onClick={() => void run('download')}
                icon={
                  showDownloadProgress ? (
                    <Progress
                      type="circle"
                      size={token.fontSize}
                      strokeWidth={12}
                      percent={Math.floor((downloading && downloadFailed ? 0 : progress?.percent) ?? 0)}
                      showInfo={false}
                      strokeColor={downloading ? token.colorPrimary : token.colorError}
                      railColor={token.colorBorder}
                      status={downloading ? 'active' : 'exception'}
                      aria-label={t('更新下载进度')}
                    />
                  ) : (
                    <DownloadOutlined />
                  )
                }
              >
                {t('下载更新')}
              </Button>
            )}
            {result?.status === 'available' && (
              <Button disabled={busy} onClick={() => void run('openRelease')}>
                {t('手动下载')}
              </Button>
            )}
            {result?.status === 'downloaded' && (
              <Button disabled={busy} loading={pending === 'install'} onClick={() => void run('install')}>
                {t('重启并安装')}
              </Button>
            )}
          </Flex>
          <Typography.Text type="secondary" role="status">
            {pending === 'check' && t('正在检查更新')}
            {downloading && t(!progress?.total ? '正在准备下载更新' : progress.percent >= 100 ? '正在校验更新' : '正在下载更新')}
            {!pending && result && t(status[result.status], result.status === 'upToDate' ? undefined : { version: result.version })}
          </Typography.Text>
          <ErrorNotice errors={[error, desktopConsole.error]} />
        </>
      )}
    </Flex>
  )
}
