import MonitorPanel from '@/components/monitorPanel'
import type { DatabaseMonitorPanelProps } from '@/databases/typings'

import { monitorConfig } from './constant'

export default function DatabaseMonitor(props: DatabaseMonitorPanelProps) {
  return <MonitorPanel {...props} config={monitorConfig} />
}
