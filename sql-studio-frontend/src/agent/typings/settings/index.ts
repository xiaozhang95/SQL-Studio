export interface AIStatus {
  configured: boolean
  model: string
  source: 'saved' | 'environment' | 'none'
  models: { id: string; name: string }[]
}
export interface AIUpdate {
  apiKey: string
  model: string
}
