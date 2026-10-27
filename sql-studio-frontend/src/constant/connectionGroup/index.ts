export const defaultConnectionGroup = '默认分组'
/** 空分组及旧连接使用同一显示名称，不改变连接 ID。 */
export const connectionGroupName = (group?: string) => group?.trim() || defaultConnectionGroup
