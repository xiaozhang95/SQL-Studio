import mysqlLogo from '@/assets/databases/mysql-icon.png'
import { databaseTypeInfo } from '@/constant/database'
import type { DatabaseType } from '@/typings/database'

/** 仅展示数据库原有品牌资源，不用通用图标替代或修改品牌颜色。 */
export default function EngineIcon({ type }: { type?: DatabaseType }) {
  const engine = databaseTypeInfo(type)
  return (
    <span className={`engine-symbol ${engine.className}`} aria-hidden="true">
      <img src={mysqlLogo} alt="" />
    </span>
  )
}
