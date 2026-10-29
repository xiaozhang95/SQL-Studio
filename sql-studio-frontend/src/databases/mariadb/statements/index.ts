import { splitSQLStatements, useDatabaseSQL } from '../../mysql/statements/index.ts'

/** 保留 MariaDB 和 MySQL 两种可执行注释，避免把独立语句误当空脚本。 */
export const splitMariaDBStatements = (script: string) => splitSQLStatements(script, ['!', 'M!'])
export const useMariaDBDatabase = useDatabaseSQL
