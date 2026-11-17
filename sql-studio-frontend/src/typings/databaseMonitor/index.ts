export type MetricFormat = 'count' | 'countRate' | 'bytes' | 'rate' | 'seconds' | 'milliseconds' | 'microseconds' | 'percent' | 'ratio' | 'date' | 'text' | 'flag'
export type MetricDefinition = { readonly key: string; readonly label: string; readonly format: MetricFormat; readonly source?: 'counter' }
export type TrendSeries = MetricDefinition & { readonly tone: 'primary' | 'warning' | 'secondary' | 'link' }
export type MonitorPanelConfig = {
  readonly title: string
  readonly overview: readonly MetricDefinition[]
  readonly activity: readonly MetricDefinition[]
  readonly charts: readonly { readonly key: string; readonly title: string; readonly series: readonly TrendSeries[] }[]
  readonly sectionLabels: Readonly<Record<string, string>>
  readonly fields: Readonly<Record<string, { readonly label: string; readonly format: MetricFormat }>>
  readonly roleLabels?: Readonly<Record<string, string>>
  readonly notice?: string
  readonly capacity?: { readonly used: string; readonly limit: string; readonly label: string }
}
