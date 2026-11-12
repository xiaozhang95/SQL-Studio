import { theme } from 'antd'

import { createThemeConfig } from '@/constant/theme'
import type { ThemeMode, ThemePreference } from '@/typings/theme'

import { settingsLayout } from '../../constant/settings'

/** 用原生主题 token 绘制工作区缩略图，不改变应用实际主题。 */
function WorkspacePreview({ mode }: { mode: ThemeMode }) {
  const token = theme.getDesignToken(createThemeConfig(mode))
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: '18px 1fr',
        height: '100%',
        minWidth: 0,
        overflow: 'hidden',
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadiusSM
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingInline: 6, borderBottom: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgLayout }}>
        {[0, 1, 2].map((item) => (
          <span key={item} style={{ width: 4, height: 4, borderRadius: '50%', background: token.colorTextQuaternary }} />
        ))}
        <span style={{ width: '35%', height: 3, marginInlineStart: 2, background: token.colorTextQuaternary }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '24% 1fr', minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '8px 4px', borderRight: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgLayout }}>
          {[0, 1, 2, 3].map((item) => (
            <span key={item} style={{ height: 3, background: item === 1 ? token.colorPrimary : token.colorTextQuaternary }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 7, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            {['65%', '45%', '80%'].map((width, index) => (
              <span key={width} style={{ width, height: 3, background: index === 0 ? token.colorPrimary : token.colorTextQuaternary }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: 1, padding: 4, background: token.colorBorderSecondary }}>
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} style={{ background: index < 3 ? token.colorFillAlter : token.colorBgContainer }} />
            ))}
          </div>
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
