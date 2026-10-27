import { getDatabaseAdapter } from '@/databases'
import type { DatabaseType } from '@/databases/typings'

/** 按当前参考图展示海豚状态图标：白色剪影不变，仅底色反映连接状态。 */
export default function EngineIcon({
  type,
  variant = 'icon',
  connected = true,
  size = variant === 'logo' ? 40 : 32
}: {
  type?: DatabaseType
  variant?: 'icon' | 'logo'
  connected?: boolean
  size?: number
}) {
  const engine = getDatabaseAdapter(type).profile
  return (
    <span
      className={`engine-symbol ${engine.className} ${connected ? 'is-connected' : 'is-closed'}${variant === 'logo' ? ' is-logo' : ''}`}
      aria-hidden="true"
      style={{
        flex: 'none',
        width: size,
        height: size,
        borderRadius: size === 20 ? 4 : 6,
        display: 'inline-grid',
        placeItems: 'center',
        border: 0,
        background: connected ? 'var(--ant-color-success)' : 'linear-gradient(var(--ant-color-text-disabled), var(--ant-color-text-disabled)), var(--surface)'
      }}
    >
      <img src={engine.icon} alt="" style={{ display: 'block', width: '80%', height: '80%', objectFit: 'contain' }} />
    </span>
  )
}
