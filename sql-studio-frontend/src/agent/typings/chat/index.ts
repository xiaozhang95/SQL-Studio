export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  estimatedTokens?: number
  window: number
}
export interface ChatEvent {
  createdAt?: string
  type:
    | 'user'
    | 'status'
    | 'context'
    | 'model_start'
    | 'reasoning_delta'
    | 'answer_delta'
    | 'tool_start'
    | 'write_confirmation'
    | 'tool_result'
    | 'answer'
    | 'usage'
    | 'error'
    | 'turn_end'
    | 'done'
    | 'heartbeat'
  text?: string
  tool?: string
  arguments?: string
  result?: unknown
  usage?: TokenUsage
}
export interface Entry {
  createdAt?: string
  id: number
  role: 'user' | 'assistant' | 'tool' | 'thinking' | 'error'
  text: string
  result?: unknown
  tool?: string
  streaming?: boolean
  incomplete?: boolean
}
