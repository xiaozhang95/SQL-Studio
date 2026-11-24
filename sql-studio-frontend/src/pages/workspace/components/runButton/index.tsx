import { Button } from 'antd'

import StudioIcon from '@/components/studioIcon'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'

const runShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘↵' : 'Ctrl↵'

type Props = {
  themeMode: ThemeMode
  disabled?: boolean
  onClick: () => void
}

/** SQL 与 Redis 编辑器共用的唯一 primary 运行操作。 */
export default function RunButton({ themeMode, disabled, onClick }: Props) {
  const { t } = useTranslation()
  return (
    <Button className="query-run-button" type="primary" icon={<StudioIcon name="play" size={14} />} onClick={onClick} disabled={disabled}>
      {t('运行')}
      <span style={{ marginInlineStart: 3, opacity: themeMode === 'dark' ? 1 : 0.75 }}>{runShortcut}</span>
    </Button>
  )
}
