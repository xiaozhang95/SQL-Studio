export interface WriteConfirmationRequest {
  approvalId: string
  connection: string
  database: string
  objects: string[]
  sql: string
}

export interface ContinueConfirmationRequest {
  approvalId: string
  kind: 'input' | 'result' | 'context' | 'recovery'
  detail: string
}

export type ConfirmationRequest = WriteConfirmationRequest | ContinueConfirmationRequest
