export interface WriteConfirmationRequest {
  approvalId: string
  connection: string
  database: string
  objects: string[]
  sql: string
}
