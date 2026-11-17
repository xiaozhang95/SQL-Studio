import { Card, Empty, Flex, theme, Typography } from 'antd'
import { useMemo, useState } from 'react'

import { useTranslation } from '@/hooks/useTranslation'
import type { MonitorSnapshot } from '@/typings/database'

import { chartLayout } from '../../constant'
import type { TrendSeries } from '../../constant'
import { formatMetric, metricValue } from '../../utils'

type Props = { title: string; series: readonly TrendSeries[]; history: readonly MonitorSnapshot[] }

export default function TrendChart({ title, series, history }: Props) {
  const { t, language } = useTranslation()
  const { token } = theme.useToken()
  const [activeIndex, setActiveIndex] = useState<number>()
  const samples = useMemo(() => history.filter((sample) => Number.isFinite(Date.parse(sample.sampledAt))), [history])
  const tracks = useMemo(
    () =>
      series.map((item) => ({
        ...item,
        points: samples.flatMap((sample, index) => {
          const raw = metricValue(sample, item.key)
          const value = raw === undefined || raw === '' ? NaN : Number(raw)
          return Number.isFinite(value) && value >= 0 ? [{ index, value }] : []
        })
      })),
    [series, samples]
  )
  const peak = Math.max(1, ...tracks.flatMap((track) => track.points.map((point) => point.value)))
  const divisions = series[0]?.format === 'count' ? Math.min(4, Math.ceil(peak)) : 4
  const step = 10 ** Math.floor(Math.log10(peak / divisions))
  const maximum = Math.ceil(peak / divisions / step) * step * divisions
  const plotWidth = chartLayout.width - chartLayout.left - chartLayout.right
  const plotHeight = chartLayout.height - chartLayout.top - chartLayout.bottom
  const firstTime = samples[0] ? Date.parse(samples[0].sampledAt) : 0
  const lastSample = samples.at(-1)
  const lastTime = lastSample ? Date.parse(lastSample.sampledAt) : firstTime
  const x = (index: number) => chartLayout.left + (lastTime === firstTime ? plotWidth / 2 : ((Date.parse(samples[index].sampledAt) - firstTime) / (lastTime - firstTime)) * plotWidth)
  const y = (value: number) => chartLayout.top + plotHeight * (1 - value / maximum)
  const currentIndex = Math.min(activeIndex ?? samples.length - 1, samples.length - 1)
  const current = samples[currentIndex]
  const colors = { primary: token.colorPrimary, warning: token.colorWarning, secondary: token.colorTextTertiary, link: token.colorLink }
  const time = (sample: MonitorSnapshot) => new Date(sample.sampledAt).toLocaleTimeString(language, { hour12: false })
  const available = tracks.some((track) => track.points.length > 0)
  return (
    <Card size="small" title={t(title)} style={{ minWidth: 0 }}>
      <Flex vertical gap="small">
        <Flex justify="space-between" align="center" wrap gap="small" style={{ minHeight: token.controlHeight }}>
          <Flex wrap gap="middle">
            {tracks.map((track) => (
              <Flex key={track.key} align="center" gap="small">
                <span aria-hidden style={{ width: token.sizeSM, height: token.lineWidthBold, background: colors[track.tone] }} />
                <Typography.Text>
                  {t(track.label)}: {formatMetric(metricValue(current, track.key), track.format, language)}
                </Typography.Text>
              </Flex>
            ))}
          </Flex>
          {current && <Typography.Text type="secondary">{time(current)}</Typography.Text>}
        </Flex>
        {available ? (
          <svg
            viewBox={`0 0 ${chartLayout.width} ${chartLayout.height}`}
            style={{ display: 'block', width: '100%', color: token.colorTextSecondary, touchAction: 'pan-y' }}
            role="group"
            aria-label={`${t(title)} · ${t('左右方向键查看采样点')}`}
            tabIndex={0}
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect()
              if (!bounds.width) return
              const position = ((event.clientX - bounds.left) / bounds.width) * chartLayout.width
              let nearest = 0
              samples.forEach((_, index) => {
                if (Math.abs(x(index) - position) < Math.abs(x(nearest) - position)) nearest = index
              })
              setActiveIndex(nearest)
            }}
            onPointerLeave={() => setActiveIndex(undefined)}
            onBlur={() => setActiveIndex(undefined)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
              event.preventDefault()
              setActiveIndex(Math.max(0, Math.min(samples.length - 1, currentIndex + (event.key === 'ArrowLeft' ? -1 : 1))))
            }}
          >
            <title>{t(title)}</title>
            {Array.from({ length: divisions + 1 }, (_, index) => 1 - index / divisions).map((ratio) => (
              <g key={ratio}>
                <line x1={chartLayout.left} x2={chartLayout.width - chartLayout.right} y1={y(maximum * ratio)} y2={y(maximum * ratio)} stroke={token.colorBorderSecondary} />
                <text x={chartLayout.left - token.marginXS} y={y(maximum * ratio)} textAnchor="end" dominantBaseline="middle" fill="currentColor">
                  {formatMetric(String(maximum * ratio), series[0]?.format ?? 'count', language)}
                </text>
              </g>
            ))}
            {tracks.map((track) => {
              const points = track.points.map((point) => `${x(point.index)},${y(point.value)}`).join(' ')
              const first = track.points[0]
              const last = track.points.at(-1)
              return (
                <g key={track.key}>
                  {first && last && <polygon points={`${x(first.index)},${y(0)} ${points} ${x(last.index)},${y(0)}`} fill={colors[track.tone]} fillOpacity={0.1} />}
                  <polyline points={points} fill="none" stroke={colors[track.tone]} strokeWidth={2} strokeLinejoin="round" />
                  {track.points
                    .filter((point) => point.index === currentIndex || track.points.length === 1)
                    .map((point) => (
                      <circle key={point.index} cx={x(point.index)} cy={y(point.value)} r={3} fill={colors[track.tone]} stroke={token.colorBgContainer}>
                        <title>{`${time(samples[point.index])} · ${t(track.label)}: ${formatMetric(metricValue(samples[point.index], track.key), track.format, language)}`}</title>
                      </circle>
                    ))}
                </g>
              )
            })}
            {current && <line x1={x(currentIndex)} x2={x(currentIndex)} y1={chartLayout.top} y2={y(0)} stroke={token.colorTextTertiary} strokeDasharray="4 4" />}
            {samples[0] && (
              <text x={chartLayout.left} y={chartLayout.height - token.marginXS} fill="currentColor">
                {time(samples[0])}
              </text>
            )}
            {samples.length > 1 && (
              <text x={chartLayout.width - chartLayout.right} y={chartLayout.height - token.marginXS} fill="currentColor" textAnchor="end">
                {time(samples[samples.length - 1])}
              </text>
            )}
          </svg>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('服务端未返回此项统计')} />
        )}
      </Flex>
    </Card>
  )
}
