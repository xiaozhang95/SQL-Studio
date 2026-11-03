export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  estimatedTokens?: number
  window: number
}
export interface ChatEvent {
  type: 'user' | 'status' | 'context' | 'model_start' | 'reasoning_delta' | 'answer_delta' | 'tool_start' | 'tool_result' | 'answer' | 'usage' | 'error' | 'turn_end' | 'done' | 'heartbeat'
  text?: string
  tool?: string
  arguments?: string
  result?: unknown
  usage?: TokenUsage
}
export interface Entry {
  id: number
  role: 'user' | 'assistant' | 'tool' | 'thinking'
  text: string
  result?: unknown
  tool?: string
  streaming?: boolean
  incomplete?: boolean
}
