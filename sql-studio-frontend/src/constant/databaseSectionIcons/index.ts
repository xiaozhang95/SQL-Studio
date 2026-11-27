import type { StudioIconName } from '@/components/studioIcon'
import type { DatabaseSection } from '@/hooks/useAppSection'

export const databaseSectionIconNames = { monitor: 'activity', sync: 'swap' } as const satisfies Record<DatabaseSection, StudioIconName>
