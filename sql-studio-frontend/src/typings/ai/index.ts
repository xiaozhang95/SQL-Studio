export type AITable = { name: string; columns: string[]; comment?: string }
export type AIContext = { connectionId: string; database: string; schema?: string; table?: string; tables: AITable[] }
export type AIRequest = AIContext & { action: 'complete' | 'optimize'; sql?: string; prefix?: string; suffix?: string; document?: string }
export type AIResult = { completion?: string; sql?: string; explanation?: string }
