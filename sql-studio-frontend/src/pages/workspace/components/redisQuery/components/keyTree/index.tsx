import { FileOutlined, FolderOpenOutlined, FolderOutlined } from '@ant-design/icons'
import { theme, Tree } from 'antd'
import type { TreeDataNode } from 'antd'
import { useMemo, useState } from 'react'

import { useTranslation } from '@/hooks/useTranslation'
import type { RedisKey } from '@/services/redis'

import { objectTreeLayout } from '../../../../constant/layout'

type Node = Omit<TreeDataNode, 'children' | 'title'> & { children?: Node[]; title?: string; item?: RedisKey; label: string; count: number }
type Props = { keys: readonly RedisKey[]; selected?: string; onSelect: (key: RedisKey) => void }

function buildTree(keys: Props['keys']) {
  const roots: Node[] = []
  const groups = new Map<string, Node>()
  for (const item of new Map(keys.map((key) => [key.ref, key])).values()) {
    // base64 是二进制键的展示编码，不把它误当 Redis 命名空间。
    const parts = item.name.startsWith('base64:') ? [item.name] : item.name.split(':')
    let children = roots
    for (let index = 0; index < parts.length - 1; index++) {
      const key = 'group:' + JSON.stringify(parts.slice(0, index + 1))
      let group = groups.get(key)
      if (!group) {
        group = { key, label: parts[index] || '""', count: 0, selectable: false, children: [] }
        groups.set(key, group)
        children.push(group)
      }
      group.count++
      children = group.children ?? []
    }
    children.push({ key: 'key:' + item.ref, label: parts.at(-1) || '""', item, count: 1, isLeaf: true })
  }
  const decorate = (nodes: Node[]): Node[] =>
    nodes
      .sort((left, right) => Number(Boolean(left.item)) - Number(Boolean(right.item)) || left.label.localeCompare(right.label, undefined, { numeric: true }))
      .map((node) => ({
        ...node,
        title: node.item ? node.label : `${node.label} (${node.count})`,
        children: node.children ? decorate(node.children) : undefined
      }))
  return decorate(roots)
}

function visibleCount(nodes: readonly Node[], expanded: ReadonlySet<string>): number {
  return nodes.reduce((total, node) => total + 1 + (node.children && expanded.has(String(node.key)) ? visibleCount(node.children, expanded) : 0), 0)
}

/** 冒号分层只影响展示，读写始终使用完整原始键引用。 */
export default function KeyTree({ keys, selected, onSelect }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const expanded = useMemo(() => new Set(expandedKeys), [expandedKeys])
  const nodes = useMemo(() => buildTree(keys), [keys])
  return (
    <div className="object-tree" style={{ minWidth: 0, userSelect: 'none' }}>
      <Tree<Node>
        aria-label={t('Redis 键列表')}
        showIcon={false}
        blockNode
        expandAction="doubleClick"
        autoExpandParent={false}
        expandedKeys={expandedKeys}
        onExpand={(next) => setExpandedKeys(next.map(String))}
        motion={{ motionAppear: false, motionEnter: false, motionLeave: false }}
        virtual
        itemHeight={objectTreeLayout.rowHeight}
        height={Math.min(450, visibleCount(nodes, expanded) * objectTreeLayout.rowHeight)}
        styles={{
          root: { background: 'transparent' },
          itemSwitcher: { width: objectTreeLayout.switcherWidth, flexBasis: objectTreeLayout.switcherWidth },
          itemTitle: { display: 'block', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }
        }}
        treeData={nodes}
        titleRender={(node) => (
          <span title={node.item?.name ?? node.label} style={{ display: 'flex', alignItems: 'center', gap: token.marginXS, minWidth: 0 }}>
            <span aria-hidden="true" style={{ display: 'flex', flex: 'none' }}>
              {node.item ? <FileOutlined /> : expanded.has(String(node.key)) ? <FolderOpenOutlined /> : <FolderOutlined />}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.title}</span>
          </span>
        )}
        selectedKeys={selected ? ['key:' + selected] : []}
        onSelect={(_, { node }) => {
          if (node.item) onSelect(node.item)
        }}
      />
    </div>
  )
}
