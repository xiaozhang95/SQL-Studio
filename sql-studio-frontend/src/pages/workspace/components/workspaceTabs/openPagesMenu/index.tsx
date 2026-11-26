import { AppstoreOutlined, CheckOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Flex, Input, Popover, theme, Typography } from 'antd'
import type { GetRef } from 'antd'
import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useTranslation } from '@/hooks/useTranslation'

import { workspaceTabLayout } from '../../../constant/layout'
import ToolbarButton from '../../toolbarButton'

type Page = {
  id: string
  title: string
  context: string
  icon: ReactNode
  dirty?: boolean
}

type Props = {
  pages: readonly Page[]
  activeTab: string
  tabBusy: boolean
  selectTab: (id: string) => void
  closeTab: (id: string) => void
  closeOthers: () => void
}

/** The page list provides direct access to tabs anywhere in the strip. */
export default function OpenPagesMenu({ pages, activeTab, tabBusy, selectTab, closeTab, closeOthers }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const id = useId()
  const trigger = useRef<GetRef<typeof Button>>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const query = search.trim().toLocaleLowerCase()
  const filtered = pages.filter((page) => `${page.title} ${page.context}`.toLocaleLowerCase().includes(query))
  const title = t('已打开的页面')

  function changeOpen(next: boolean) {
    setOpen(next)
    if (!next) setSearch('')
  }

  function closePanel() {
    changeOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }

  function selectPage(page: Page) {
    closePanel()
    selectTab(page.id)
  }

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      destroyOnHidden
      open={open}
      onOpenChange={changeOpen}
      styles={{
        container: {
          boxSizing: 'border-box',
          width: `min(${workspaceTabLayout.menuWidth}px, calc(100dvw - ${2 * token.padding}px))`,
          border: `${token.lineWidth}px solid ${token.colorBorderSecondary}`
        }
      }}
      content={
        <Flex
          id={id}
          role="dialog"
          aria-label={title}
          vertical
          gap={token.marginSM}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || event.nativeEvent.isComposing) return
            event.stopPropagation()
            closePanel()
          }}
        >
          <Typography.Text strong>{title}</Typography.Text>
          <Input
            autoFocus
            allowClear
            aria-label={t('搜索页面名称')}
            placeholder={t('搜索页面名称')}
            prefix={<SearchOutlined />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onPressEnter={(event) => {
              if (!event.nativeEvent.isComposing && filtered[0]) selectPage(filtered[0])
            }}
          />
          <Flex
            vertical
            gap={token.marginXXS}
            style={{ maxHeight: `min(${workspaceTabLayout.menuListHeight}px, 48dvh)`, overflowY: 'auto', overflowX: 'hidden' }}
          >
            {filtered.map((page) => {
              const selected = page.id === activeTab
              return (
                <Flex
                  key={page.id}
                  className="workspace-open-page"
                  align="center"
                  style={{
                    flex: 'none',
                    borderRadius: token.borderRadius,
                    paddingInlineEnd: token.paddingXXS
                  }}
                >
                  <Button
                    type="text"
                    aria-current={selected ? 'page' : undefined}
                    title={[page.title, page.context].filter(Boolean).join('\n')}
                    style={{ minWidth: 0, flex: 1, justifyContent: 'flex-start', minHeight: token.controlHeight, height: 'auto', padding: token.paddingXS, background: 'transparent' }}
                    styles={{ content: { width: '100%', minWidth: 0 } }}
                    onClick={() => selectPage(page)}
                  >
                    <Flex align="center" gap={token.marginXS} style={{ width: '100%', minWidth: 0, textAlign: 'start' }}>
                      <span aria-hidden="true" style={{ flex: 'none' }}>{page.icon}</span>
                      <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                        <Flex align="center" gap={token.marginXXS} style={{ minWidth: 0 }}>
                          <Typography.Text ellipsis style={{ minWidth: 0 }}>{page.title}</Typography.Text>
                          {page.dirty && (
                            <span
                              role="img"
                              aria-label={t('未保存')}
                              title={t('未保存')}
                              style={{ width: 6, height: 6, flex: 'none', borderRadius: '50%', background: token.colorWarning }}
                            />
                          )}
                        </Flex>
                        {page.context && <Typography.Text type="secondary" ellipsis>{page.context}</Typography.Text>}
                      </Flex>
                      {selected && <CheckOutlined aria-hidden="true" style={{ flex: 'none', color: token.colorPrimary }} />}
                    </Flex>
                  </Button>
                  <ToolbarButton
                    className="workspace-open-page-close"
                    label={t('关闭页面 {value1}', { value1: page.title })}
                    icon={<CloseOutlined />}
                    style={{ background: 'transparent' }}
                    disabled={tabBusy}
                    onClick={() => closeTab(page.id)}
                  />
                </Flex>
              )
            })}
            {!filtered.length && <Typography.Text type="secondary" style={{ padding: token.paddingXS }}>{t('没有匹配的页面')}</Typography.Text>}
          </Flex>
          <Button
            block
            disabled={tabBusy || pages.length < 2 || !activeTab}
            onClick={() => {
              closePanel()
              closeOthers()
            }}
          >
            {t('关闭其他')}
          </Button>
        </Flex>
      }
    >
      <Button
        ref={trigger}
        type="text"
        icon={<AppstoreOutlined />}
        title={t('更多')}
        aria-label={t('更多')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
      />
    </Popover>
  )
}
