export interface Layout {
  mode?: 'readonly' | 'write'
  activeId: string
  draft: string
  expanded: string[]
}
export interface Workspace {
  schemaVersion: number
  revision: number
  state: Layout
}
export interface ConversationInfo {
  id: string
  title: string
  revision: number
  status: string
  updatedAt: string
}
