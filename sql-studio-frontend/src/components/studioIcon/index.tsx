import type { CSSProperties, ReactNode } from 'react'

import type { DatabaseSection } from '@/hooks/useAppSection'

export type StudioIconName =
  | 'database'
  | 'bot'
  | 'activity'
  | 'swap'
  | 'play'
  | 'folder'
  | 'table'
  | 'eye'
  | 'key'
  | 'sun'
  | 'moon'
  | 'sparkle'
  | 'zap'

export const databaseSectionIconNames = { monitor: 'activity', sync: 'swap' } as const satisfies Record<DatabaseSection, StudioIconName>

interface Props {
  name: StudioIconName
  size?: number
  className?: string
  style?: CSSProperties
}

/** 与应用视觉稿一致的线性 SVG 图标，避免 Ant Design 图标在不同尺寸下风格跳变。 */
export default function StudioIcon({ name, size = 16, className, style }: Props) {
  const paths: Record<StudioIconName, ReactNode> = {
    database: (
      <>
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path d="M5 5v14c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
        <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
      </>
    ),
    bot: (
      <>
        <rect x="4" y="7" width="16" height="12" rx="4" />
        <path d="M12 7V4" />
        <circle cx="9" cy="13" r="1" />
        <circle cx="15" cy="13" r="1" />
      </>
    ),
    activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
    swap: (
      <>
        <path d="M4 8h13l-3-3" />
        <path d="M20 16H7l3 3" />
      </>
    ),
    play: <path d="M8 5.5v13l11-6.5z" />,
    folder: <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    table: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M9 4v16" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="m11 12 8-8M16 4h4v4" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
      </>
    ),
    moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
    sparkle: (
      <>
        <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
        <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z" />
      </>
    ),
    zap: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  }
  const filled = name === 'play'
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}
