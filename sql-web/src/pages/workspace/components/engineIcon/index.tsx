import mariaLogo from '@/assets/databases/mariadb.svg'
import mysqlLogo from '@/assets/databases/mysql-icon.png'
import polarLogo from '@/assets/databases/polardb.png'
import postgresLogo from '@/assets/databases/postgresql.png'
import { databaseTypeInfo } from '@/constant/database'
import type { DatabaseType } from '@/typings/database'

/** 仅展示数据库原有品牌资源，不用通用图标替代或修改品牌颜色。 */
export default function EngineIcon({ type }: { type?: DatabaseType }) {
  const engine = databaseTypeInfo(type)
  const source = engine.value.startsWith('polardb') ? polarLogo : engine.value === 'mariadb' ? mariaLogo : engine.value === 'postgresql' ? postgresLogo : mysqlLogo
  return (
    <span className={`engine-symbol ${engine.className}`} aria-hidden="true">
      <img src={source} alt="" />
    </span>
  )
}
