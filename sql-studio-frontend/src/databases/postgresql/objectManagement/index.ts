import { ObjectAction } from '../../typings/objectManagement/index.ts'
import type { ObjectAction as Action, ObjectTarget } from '../../typings/objectManagement/index.ts'
import { identifier, relation, tableIdentity } from '../query/index.ts'

function name(value: string) {
  if (!value.trim() || value.includes('\0') || new TextEncoder().encode(value).length > 63) throw new Error('名称不能为空，且最多 63 个 UTF-8 字节')
  return identifier(value)
}

export const simpleObjects = {
  actions: [
    ObjectAction.CreateDatabase,
    ObjectAction.DropDatabase,
    ObjectAction.CreateSchema,
    ObjectAction.RenameSchema,
    ObjectAction.DropSchema,
    ObjectAction.DropTable,
    ObjectAction.TruncateTable,
    ObjectAction.RenameTable
  ],
  initialName: (action: Action, target: ObjectTarget) => (action === ObjectAction.RenameTable ? tableIdentity(target.table)[1] : action === ObjectAction.RenameSchema ? target.schema || '' : ''),
  resultName: (action: Action, target: ObjectTarget, value: string) => (action === ObjectAction.RenameTable ? `${identifier(tableIdentity(target.table)[0])}.${name(value)}` : value),
  sql(action: Action, target: ObjectTarget, value: string) {
    switch (action) {
      case ObjectAction.CreateDatabase:
        return `CREATE DATABASE ${name(value)};`
      case ObjectAction.DropDatabase:
        return `DROP DATABASE ${name(target.database)};`
      case ObjectAction.CreateSchema:
        return `CREATE SCHEMA ${name(value)};`
      case ObjectAction.RenameSchema:
        if (!target.schema) throw new Error('Schema 不能为空')
        if (target.schema === value) throw new Error('新名称与原名称相同')
        return `ALTER SCHEMA ${name(target.schema)} RENAME TO ${name(value)};`
      case ObjectAction.DropSchema:
        if (!target.schema) throw new Error('Schema 不能为空')
        return `DROP SCHEMA ${name(target.schema)} RESTRICT;`
      case ObjectAction.DropTable:
        return `DROP ${target.view ? 'VIEW' : 'TABLE'} ${relation(target.table)};`
      case ObjectAction.TruncateTable:
        if (target.view) throw new Error('不能清空视图')
        return `TRUNCATE TABLE ${relation(target.table)};`
      case ObjectAction.RenameTable:
        if (tableIdentity(target.table)[1] === value) throw new Error('新名称与原名称相同')
        return `ALTER ${target.view ? 'VIEW' : 'TABLE'} ${relation(target.table)} RENAME TO ${name(value)};`
      default:
        throw new Error('该操作暂不支持')
    }
  }
}
