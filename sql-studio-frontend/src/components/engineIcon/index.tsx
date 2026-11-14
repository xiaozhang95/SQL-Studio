import { getDatabaseAdapter } from '@/databases'
import type { DatabaseType } from '@/databases/typings'

/** 图形及展示方式由引擎 profile 提供，状态与尺寸由此统一渲染。 */
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
  const originalBrand = engine.iconPresentation === 'brand'
  // text-tertiary 带透明度，先叠在主题容器底色上，避免选中行蓝色透入灰色状态底板。
  const statusBackground = connected ? 'var(--ant-color-success)' : 'linear-gradient(var(--inactive-icon), var(--inactive-icon)), var(--surface)'
  return (
    <span
      className={`engine-symbol ${engine.className} ${connected ? 'is-connected' : 'is-closed'}${variant === 'logo' ? ' is-logo' : ''}`}
      aria-hidden="true"
      style={{
        flex: 'none',
        width: size,
        height: size,
        borderRadius: originalBrand ? 0 : size === 20 ? 4 : 6,
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        border: 0,
        background: originalBrand ? (engine.iconBackground ?? 'transparent') : statusBackground
      }}
    >
      {originalBrand && variant === 'icon' && (
        <span
          style={{
            position: 'absolute',
            zIndex: 1,
            insetInlineEnd: 0,
            bottom: 0,
            width: Math.max(5, size / 4),
            height: Math.max(5, size / 4),
            borderRadius: '50%',
            background: statusBackground,
            outline: '1px solid var(--surface)'
          }}
        />
      )}
      <img
        src={engine.icon}
        alt=""
        style={{
          display: 'block',
          width: originalBrand ? '100%' : '80%',
          height: originalBrand ? '100%' : '80%',
          objectFit: 'contain',
          boxSizing: 'border-box',
          padding: engine.iconBackground ? size * 0.1 : 0,
          filter: originalBrand ? undefined : 'brightness(0) invert(1)'
        }}
      />
    </span>
  )
}
