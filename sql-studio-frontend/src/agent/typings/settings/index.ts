export interface AIStatus {
  configId: string
  configured: boolean
  model: string
  source: 'saved' | 'environment' | 'none'
  models: { id: string; name: string }[]
}
export interface AIUpdate {
  configId: string
}
