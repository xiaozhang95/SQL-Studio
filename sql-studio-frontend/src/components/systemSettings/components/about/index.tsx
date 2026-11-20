import { Button, Flex, Progress, Typography } from 'antd'

import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'

import { useDesktopConsole } from '../../hooks/useDesktopConsole'
import { useDesktopUpdates } from '../../hooks/useDesktopUpdates'

export default function About({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation()
  const { desktop, result, pending, progress, downloadFailed, error, run } = useDesktopUpdates()
  const desktopConsole = useDesktopConsole()
  const busy = disabled || Boolean(pending) || desktopConsole.opening
  const status = {
    upToDate: '当前已是最新版本',
    available: '发现新版本 {version}',
    downloaded: '已下载版本 {version}'
  } as const

  return (
    <Flex vertical gap="middle">
      <Flex gap="middle" align="baseline" wrap>
        <Typography.Text>{t('当前版本')}</Typography.Text>
        <Typography.Text>{import.meta.env.VITE_SQL_STUDIO_VERSION}</Typography.Text>
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
              <Flex gap="small" align="center">
                <Button disabled={busy} onClick={() => void run('download')}>
                  {t('下载更新')}
                </Button>
                {progress && (pending === 'download' || downloadFailed) && (
                  <Progress
                    type="circle"
                    size={32}
                    percent={Math.floor(progress.percent)}
                    showInfo={progress.total > 0 || progress.percent > 0 || downloadFailed}
                    status={downloadFailed ? 'exception' : 'active'}
                    aria-label={t('更新下载进度')}
                  />
                )}
              </Flex>
            )}
            {result?.status === 'available' && (
              <Button disabled={busy} onClick={() => void run('openRelease')}>
                {t('前往下载')}
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
            {pending === 'download' && t(!progress?.total ? '正在准备下载更新' : progress.percent >= 100 ? '正在校验更新' : '正在下载更新')}
            {!pending && result && t(status[result.status], result.status === 'upToDate' ? undefined : { version: result.version })}
          </Typography.Text>
          <ErrorNotice errors={[error, desktopConsole.error]} />
        </>
      )}
    </Flex>
  )
}
