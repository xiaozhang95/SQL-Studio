import { ObjectAction } from '../../typings/objectManagement/index.ts'
import type { ObjectAction as Action, ObjectTarget } from '../../typings/objectManagement/index.ts'
import { identifier, relation, tableIdentity } from '../query/index.ts'

export const simpleObjects = {
  actions: [ObjectAction.DropTable, ObjectAction.TruncateTable, ObjectAction.RenameTable],
  canApply: (action: Action, target: ObjectTarget) => !target.view || action === ObjectAction.DropTable,
  initialName: (action: Action, target: ObjectTarget) => (action === ObjectAction.RenameTable ? tableIdentity(target.table).name : ''),
  resultName: (action: Action, target: ObjectTarget, value: string) => (action === ObjectAction.RenameTable ? identifier(tableIdentity(target.table).schema) + '.' + identifier(value) : value),
  sql(action: Action, target: ObjectTarget, value: string) {
    switch (action) {
      case ObjectAction.DropTable:
        return `DROP ${target.view ? 'VIEW' : 'TABLE'} ${relation(target.table)};`
      case ObjectAction.TruncateTable:
        if (!target.view) return `TRUNCATE TABLE ${relation(target.table)};`
        break
      case ObjectAction.RenameTable:
        if (tableIdentity(target.table).name === value) throw new Error('新名称与原名称相同')
        if (!target.view) return `ALTER TABLE ${relation(target.table)} RENAME TO ${identifier(value)};`
        break
    }
    throw new Error('该操作暂不支持')
  }
}
