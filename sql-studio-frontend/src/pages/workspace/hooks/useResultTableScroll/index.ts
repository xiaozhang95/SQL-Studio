import type { TableRef } from 'antd/es/table'
import { useLayoutEffect, useRef } from 'react'

import type { QueryResult } from '@/typings/database'

type Options = { result?: QueryResult; runId?: string; view: string | null; page: number; search: string; sortKey: string; added: number }

/** 虚拟行插入/移除后等待原生行高测量，再固定到第一页的起点。 */
export function useResultTableScroll({ result, runId, view, page, search, sortKey, added }: Options) {
  const table = useRef<TableRef>(null)
  useLayoutEffect(() => {
    table.current?.scrollTo({ top: 0 })
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      table.current?.scrollTo({ index: 0, align: 'start' })
      secondFrame = requestAnimationFrame(() => table.current?.scrollTo({ top: 0 }))
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [result, runId, view, page, search, sortKey, added])
  return table
}
