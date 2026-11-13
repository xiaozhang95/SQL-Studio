export const defaultConnectionGroup = '默认分组'
/** 空分组及旧连接使用同一显示名称，不改变连接 ID。 */
export const connectionGroupName = (group?: string) => group?.trim() || defaultConnectionGroup

/** Translate only the built-in label; keep stored group names and tree keys stable. */
export const connectionGroupLabel = (group: string, translate: (message: string) => string) => (group === defaultConnectionGroup ? translate(defaultConnectionGroup) : group)
