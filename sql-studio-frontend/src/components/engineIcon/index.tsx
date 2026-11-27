import { getDatabaseProfile } from '@/databases'
import type { DatabaseType } from '@/databases/typings'

const engineIconSize = 18

/** 图形及展示方式由引擎 profile 提供，状态与尺寸由此统一渲染。 */
export default function EngineIcon({ type, connected = true, size = engineIconSize }: { type?: DatabaseType; connected?: boolean; size?: 18 | 24 | 40 }) {
  const engine = getDatabaseProfile(type)
  const closedIcon = connected ? undefined : engine.closedIcon
  const useClosedFilter = !connected && !closedIcon
  const closedMask = useClosedFilter ? engine.closedIconMaskFilter : undefined
  // 18px 底板内使用 14px 图形，四边均留 2px，避免小尺寸出现半像素偏移。
  const glyphSize = size === engineIconSize ? 14 : '80%'
  return (
    <span
      className={`engine-symbol ${engine.className} ${connected ? 'is-connected' : 'is-closed'}`}
      aria-hidden="true"
      style={{
        flex: 'none',
        width: size,
        height: size,
        display: 'inline-grid',
        placeItems: 'center',
        isolation: closedMask ? 'isolate' : undefined,
        borderRadius: size === engineIconSize ? 'var(--ant-border-radius-sm)' : 'var(--ant-border-radius)',
        // 灰色与容器底色合成，避免选中行透入半透明底板。
        background: connected ? 'var(--engine-icon-background)' : 'linear-gradient(var(--inactive-icon), var(--inactive-icon)), var(--surface)'
      }}
    >
      <img
        src={closedIcon ?? engine.icon}
        alt=""
        style={{
          display: 'block',
          width: glyphSize,
          height: glyphSize,
          objectFit: 'contain',
          filter: useClosedFilter ? (closedMask ?? 'brightness(0) invert(1)') : undefined,
          // 滤色保留白色图形，黑色区域透出已隔离的灰底。
          mixBlendMode: closedMask ? 'screen' : undefined
        }}
      />
    </span>
  )
}
