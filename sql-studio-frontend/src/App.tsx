import { App as AntApp, ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'

import { appearance } from '@/constant/appearance'
import { useThemePreference } from '@/hooks/useThemePreference'
import Workspace from '@/pages/workspace'

/** 动态弹框使用 AntApp 上下文，确保亮暗主题一致。 */
export default function App() {
  const { preference, setPreference, mode, error, ready, saving } = useThemePreference()
  return (
    <ConfigProvider
      locale={zhCN}
      componentSize={appearance.controlSize}
      tag={{ variant: 'solid' }}
      theme={{
        algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        cssVar: { key: 'sql-studio-theme' }
      }}
    >
      <AntApp message={{ styles: { root: { display: 'none' } } }}>
        <Workspace themeReady={ready} themeSaving={saving} themeError={error} themeMode={mode} themePreference={preference} onThemeChange={setPreference} />
      </AntApp>
    </ConfigProvider>
  )
}
