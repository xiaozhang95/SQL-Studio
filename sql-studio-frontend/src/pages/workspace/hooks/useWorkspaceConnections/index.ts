import { useCallback, useEffect, useMemo, useState } from 'react'

import { connectionGroupName, defaultConnectionGroup } from '@/constant/connectionGroup'
import { getConnectionGroups, getConnections } from '@/services/database'
import type { Connection } from '@/typings/database'

/** Own connection list loading, errors and saved group names without query state. */
export function useWorkspaceConnections(onLoaded: (connections: Connection[]) => void) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [savedGroups, setSavedGroups] = useState<string[]>([defaultConnectionGroup])
  const groups = useMemo(
    () => [
      defaultConnectionGroup,
      ...[...new Set([...savedGroups, ...connections.map((item) => connectionGroupName(item.group))])].filter((name) => name !== defaultConnectionGroup).sort((a, b) => a.localeCompare(b, 'zh-CN'))
    ],
    [savedGroups, connections]
  )
  const [connectionLoading, setConnectionLoading] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const applyConnections = useCallback(
    (data: Connection[]) => {
      setConnections(data)
      onLoaded(data)
    },
    [onLoaded]
  )
  const loadConnections = useCallback(async () => {
    setConnectionLoading(true)
    setConnectionError('')
    try {
      const [data, groupNames] = await Promise.all([getConnections(), getConnectionGroups()])
      applyConnections(data)
      setSavedGroups(groupNames)
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : '连接列表加载失败')
    } finally {
      setConnectionLoading(false)
    }
  }, [applyConnections])
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([getConnections(controller.signal), getConnectionGroups(controller.signal)])
      .then(([data, groupNames]) => {
        if (!controller.signal.aborted) {
          applyConnections(data)
          setSavedGroups(groupNames)
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setConnectionError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setConnectionLoading(false)
      })
    return () => controller.abort()
  }, [applyConnections])
  return { connections, setConnections, savedGroups, setSavedGroups, groups, connectionLoading, connectionError, loadConnections }
}
