import MonitorPanel from '@/components/monitorPanel'
import type { DatabaseMonitorPanelProps } from '@/databases/typings'

import { monitorConfig } from '../../mysql/monitor/constant'

/** MariaDB uses its own sampled connection and the compatible status definitions. */
export default function MariaDBMonitor(props: DatabaseMonitorPanelProps) {
  return <MonitorPanel {...props} config={monitorConfig} />
}
