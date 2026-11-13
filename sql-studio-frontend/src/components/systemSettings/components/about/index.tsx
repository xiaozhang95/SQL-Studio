import { App, Button, Flex, Typography } from 'antd'

import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'

import { useDesktopUpdates } from '../../hooks/useDesktopUpdates'

export default function About({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation()
  const { modal } = App.useApp()
  const { desktop, result, pending, error, run } = useDesktopUpdates()
  const busy = disabled || Boolean(pending)
  const status = {
    upToDate: '当前已是最新版本',
    available: '发现新版本 {version}',
    downloaded: '已下载版本 {version}'
  } as const

  function confirmInstall() {
    modal.confirm({
      title: t('重启 SQL Studio 并安装更新？'),
      content: t('安装将关闭 SQL Studio，请先保存当前工作。'),
      okText: t('重启并安装'),
      cancelText: t('取消'),
      onOk: () => run('install')
    })
  }

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
              <Button disabled={busy} onClick={confirmInstall}>
                {t('重启并安装')}
              </Button>
            )}
          </Flex>
          <Typography.Text type="secondary" role="status">
            {pending === 'check' && t('正在检查更新')}
            {pending === 'download' && t('正在下载更新')}
            {!pending && result && t(status[result.status], result.status === 'upToDate' ? undefined : { version: result.version })}
          </Typography.Text>
          <ErrorNotice error={error} />
        </>
      )}
    </Flex>
  )
}
