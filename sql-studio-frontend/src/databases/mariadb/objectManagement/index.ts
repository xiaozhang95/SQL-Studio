import type { Column } from '../../../typings/database/index.ts'
import { mysqlObjects } from '../../mysql/objectManagement/index.ts'
import type { DatabaseObjectAdapter } from '../../typings/objectManagement/index.ts'

/** MariaDB COLUMN_DEFAULT 用引号区分字符串和表达式，不可直接当作 MySQL 字面值。 */
function fields(columns: Column[], ddl = '') {
  return mysqlObjects.fields(columns, ddl).map((field, index) => {
    const raw = columns[index].default
    if (raw === null || raw === 'NULL') return { ...field, defaultMode: field.nullable ? ('null' as const) : ('none' as const), defaultValue: '' }
    if (/^'(?:''|[^'])*'$/.test(raw)) {
      return { ...field, defaultMode: 'literal' as const, defaultValue: raw.slice(1, -1).replaceAll("''", "'"), locked: field.locked || raw.includes('\\') }
    }
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) || field.defaultMode === 'expression') return field
    // 任意表达式保持原定义；不把 uuid()/序列默认值改写为字符串。
    return { ...field, defaultMode: 'expression' as const, locked: true }
  })
}

export const mariadbObjects: DatabaseObjectAdapter = {
  ...mysqlObjects,
  fields,
  collationsSQL:
    "SELECT FULL_COLLATION_NAME AS Collation, CHARACTER_SET_NAME AS Charset, CASE WHEN FULL_COLLATION_NAME=@@collation_server AND CHARACTER_SET_NAME=@@character_set_server THEN 'Yes' ELSE IS_DEFAULT END AS `Default` FROM information_schema.COLLATION_CHARACTER_SET_APPLICABILITY ORDER BY FULL_COLLATION_NAME",
  defaultCollation: (options) =>
    options.find((item) => item.charset === 'utf8mb4' && item.default) ||
    options.find((item) => item.name === 'utf8mb4_general_ci') ||
    options.find((item) => item.charset === 'utf8mb4') ||
    mysqlObjects.defaultCollation(options),
  collations: (result) => {
    const charset = result.columns.findIndex((column) => column.name.toLowerCase() === 'charset')
    if (charset < 0) throw new Error('排序规则元数据缺少字符集')
    return mysqlObjects.collations({ ...result, rows: result.rows.filter((row) => typeof row[charset] === 'string' && row[charset]) })
  }
}
