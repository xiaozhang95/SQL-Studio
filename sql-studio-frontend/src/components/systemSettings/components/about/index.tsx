import { Button, Flex, Typography } from 'antd'

import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'

import { useDesktopConsole } from '../../hooks/useDesktopConsole'
import { useDesktopUpdates } from '../../hooks/useDesktopUpdates'

export default function About({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation()
  const { desktop, result, pending, error, run } = useDesktopUpdates()
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
          <Flex gap="small" wrap>
            <Button disabled={busy && pending !== 'check'} loading={pending === 'check'} onClick={() => void run('check')}>
              {t('检查更新')}
            </Button>
            <Button disabled={busy && !desktopConsole.opening} loading={desktopConsole.opening} onClick={() => void desktopConsole.openConsole()}>
              {t('查看控制台')}
            </Button>
            {result?.status === 'available' && result.canDownload && (
              <Button disabled={busy && pending !== 'download'} loading={pending === 'download'} onClick={() => void run('download')}>
                {t('下载更新')}
              </Button>
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
            {pending === 'download' && t('正在下载更新')}
            {!pending && result && t(status[result.status], result.status === 'upToDate' ? undefined : { version: result.version })}
          </Typography.Text>
          <ErrorNotice errors={[error, desktopConsole.error]} />
        </>
      )}
    </Flex>
  )
}
