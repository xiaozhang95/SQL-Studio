import { DeleteOutlined, EyeOutlined, FileOutlined, FolderOpenOutlined, FolderOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Dropdown, theme, Tree } from 'antd'
import type { MenuProps, TreeDataNode } from 'antd'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import { useTranslation } from '@/hooks/useTranslation'
import type { RedisKey } from '@/services/redis'

import { objectTreeLayout } from '../../../../constant/layout'

type Node = Omit<TreeDataNode, 'children' | 'title'> & { children?: Node[]; title?: string; item?: RedisKey; label: string; count: number }
type Props = {
  keys: readonly RedisKey[]
  selected?: string
  expandedKeys: string[]
  onExpand: (keys: string[]) => void
  onSelect: (key: RedisKey, refresh?: boolean) => void
  onRequestDelete: (key: RedisKey) => void
  onCreate: () => void
  onRefresh: () => void
  disabled: boolean
}

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
export default function KeyTree({ keys, selected, expandedKeys, onExpand, onSelect, onRequestDelete, onCreate, onRefresh, disabled }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const [menuOpen, setMenuOpen] = useState(false)
  const [context, setContext] = useState<Node>()
  const [height, setHeight] = useState(320)
  const holder = useRef<HTMLDivElement>(null)
  const expanded = useMemo(() => new Set(expandedKeys), [expandedKeys])
  const nodes = useMemo(() => buildTree(keys), [keys])
  useLayoutEffect(() => {
    const element = holder.current
    if (!element) return
    const measure = () => setHeight(Math.max(1, element.clientHeight))
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [])
  const menu: MenuProps = {
    items: [
      ...(context?.item
        ? [
            { key: 'open', label: t('查看键详情'), icon: <EyeOutlined />, disabled },
            { key: 'read', label: t('刷新键详情'), icon: <ReloadOutlined />, disabled },
            { key: 'delete', label: t('删除键'), icon: <DeleteOutlined />, danger: true, disabled }
          ]
        : [{ key: 'toggle', label: t(expanded.has(String(context?.key)) ? '收起分组' : '展开分组'), icon: <FolderOpenOutlined />, disabled }]),
      { type: 'divider' },
      { key: 'create', label: t('新增键'), icon: <PlusOutlined />, disabled },
      { key: 'refresh', label: t('刷新'), icon: <ReloadOutlined />, disabled }
    ],
    onClick: ({ key }) => {
      setMenuOpen(false)
      if (disabled || !context) return
      const item = context.item
      if (key === 'delete' && item) onRequestDelete(item)
      else if ((key === 'open' || key === 'read') && item) onSelect(item, key === 'read')
      else if (key === 'create') onCreate()
      else if (key === 'refresh') onRefresh()
      else if (key === 'toggle') {
        const group = String(context.key)
        onExpand(expanded.has(group) ? expandedKeys.filter((key) => key !== group) : [...expandedKeys, group])
      }
    }
  }
  return (
    <Dropdown trigger={['contextMenu']} open={menuOpen && !disabled} onOpenChange={setMenuOpen} menu={menu}>
      <div ref={holder} className="object-tree" style={{ flex: 1, minWidth: 0, minHeight: 0, userSelect: 'none' }}>
        <Tree<Node>
          aria-label={t('Redis 键列表')}
          showIcon={false}
          blockNode
          expandAction="doubleClick"
          autoExpandParent={false}
          expandedKeys={expandedKeys}
          onExpand={(next) => onExpand(next.map(String))}
          onRightClick={({ node }) => {
            if (disabled) return
            setContext(node)
          }}
          motion={{ motionAppear: false, motionEnter: false, motionLeave: false }}
          virtual
          itemHeight={objectTreeLayout.rowHeight}
          height={Math.min(height, visibleCount(nodes, expanded) * objectTreeLayout.rowHeight)}
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
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: node.item ? token.fontFamilyCode : undefined }}>{node.title}</span>
            </span>
          )}
          selectedKeys={selected ? ['key:' + selected] : []}
          onSelect={(_, { node }) => {
            if (!disabled && node.item) onSelect(node.item)
          }}
        />
      </div>
    </Dropdown>
  )
}
