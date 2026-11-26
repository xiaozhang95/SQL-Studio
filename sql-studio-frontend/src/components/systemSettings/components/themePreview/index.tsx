import { theme } from 'antd'

import { createThemeConfig } from '@/constant/theme'
import type { ThemeMode, ThemePreference } from '@/typings/theme'

import { settingsLayout } from '../../constant/settings'

/** 用主题 token 绘制 Rail、对象栏、页签、编辑器和结果区缩略图，不改变应用实际主题。 */
function WorkspacePreview({ mode }: { mode: ThemeMode }) {
  const token = theme.getDesignToken(createThemeConfig(mode))
  const line = (key: string, width: string, color = token.colorTextQuaternary) => <span key={key} style={{ width, height: 2, borderRadius: 1, background: color }} />
  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        minWidth: 0,
        overflow: 'hidden',
        background: token.colorBgLayout,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusSM
      }}
    >
      <div
        style={{
          width: 13,
          flex: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          padding: '4px 0',
          borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 2, background: token.colorPrimary, marginBottom: 2 }} />
        {[0, 1, 2].map((item) => (
          <span key={item} style={{ width: 5, height: 3, borderRadius: 1, background: item === 0 ? token.colorPrimary : token.colorTextQuaternary }} />
        ))}
      </div>
      <div
        style={{
          width: '24%',
          flex: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          padding: '6px 4px',
          borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer
        }}
      >
        {[0, 1, 2, 3, 4].map((item) => line(`side-${item}`, item === 1 ? '70%' : item === 3 ? '55%' : '82%', item === 1 ? token.colorPrimary : token.colorTextQuaternary))}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            height: 10,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            paddingInline: 4,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer
          }}
        >
          <span style={{ width: 20, height: 4, borderRadius: 1, background: token.controlItemBgActive, borderBottom: `1px solid ${token.colorPrimary}` }} />
          <span style={{ width: 16, height: 4, borderRadius: 1, background: token.colorFillTertiary }} />
          <span style={{ width: 12, height: 4, borderRadius: 1, background: token.colorPrimary, marginInlineStart: 'auto' }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, padding: '5px 5px 2px' }}>
          {line('code-1', '58%', token.colorPrimary)}
          {line('code-2', '78%')}
          {line('code-3', '46%')}
          {line('code-4', '66%')}
        </div>
        <div
          style={{
            height: 17,
            flex: 'none',
            margin: '0 4px 4px',
            overflow: 'hidden',
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 2,
            background: token.colorFillQuaternary
          }}
        >
          <div style={{ height: 5, background: token.colorFillTertiary }} />
          {[0, 1].map((item) => (
            <div key={item} style={{ height: 4, borderTop: item === 0 ? `1px solid ${token.colorBorderSecondary}` : undefined, background: token.colorBgContainer }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ThemePreview({ preference }: { preference: ThemePreference }) {
  return (
    <div style={{ height: settingsLayout.previewHeight, display: 'grid', gridTemplateColumns: preference === 'system' ? '1fr 1fr' : '1fr', gap: 4 }}>
      {preference === 'system' ? (
        <>
          <WorkspacePreview mode="light" />
          <WorkspacePreview mode="dark" />
        </>
      ) : (
        <WorkspacePreview mode={preference} />
      )}
    </div>
  )
}
