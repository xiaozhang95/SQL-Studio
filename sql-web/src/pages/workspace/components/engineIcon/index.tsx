import mysqlDolphin from '@/assets/databases/mysql-dolphin.svg'
import { databaseTypeInfo } from '@/constant/database'
import type { DatabaseType } from '@/typings/database'

/** 按当前参考图展示海豚状态图标：白色剪影不变，仅底色反映连接状态。 */
export default function EngineIcon({ type, variant = 'icon', connected = true }: { type?: DatabaseType; variant?: 'icon' | 'logo'; connected?: boolean }) {
  const engine = databaseTypeInfo(type)
  return (
    <span className={`engine-symbol ${engine.className} ${connected ? 'is-connected' : 'is-closed'}${variant === 'logo' ? ' is-logo' : ''}`} aria-hidden="true">
      <img src={mysqlDolphin} alt="" />
    </span>
  )
}
