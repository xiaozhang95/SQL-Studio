import type { Entry } from '../../typings/chat'

export interface ConversationRound {
  id: number
  question: string
  summary: string
  entries: Entry[]
}
/** Preserve event order and error ownership; summaries use assistant text only. */
export function conversationRounds(entries: Entry[]): ConversationRound[] {
  const rounds: ConversationRound[] = []
  for (const entry of entries) {
    if (entry.role === 'user' || !rounds.length) rounds.push({ id: entry.id, question: entry.role === 'user' ? entry.text : '对话记录', summary: '', entries: [] })
    const round = rounds[rounds.length - 1]
    round.entries.push(entry)
    if (entry.role === 'assistant' && round.summary.length < 160) round.summary = (round.summary + entry.text).slice(0, 160)
  }
  return rounds
}
/** A bounded rail; the searchable full list retains every round. */
export function roundMarkers(count: number, active: number, limit = 24): number[] {
  if (count <= limit) return Array.from({ length: count }, (_, index) => index)
  const values = new Set([0, count - 1, Math.max(0, Math.min(count - 1, active))])
  for (let i = 0; i < limit - 3; i++) values.add(Math.round((i * (count - 1)) / (limit - 4)))
  return [...values].sort((a, b) => a - b)
}
