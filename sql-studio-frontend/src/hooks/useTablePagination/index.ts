import type { PaginationProps } from 'antd'
import { useMemo } from 'react'

import { tablePaginationDefaults } from '@/constant/tablePagination'
import { useTranslation } from '@/hooks/useTranslation'

/** Keep layout defaults shared while translating the count with the active language. */
export function useTablePagination(): PaginationProps {
  const { t } = useTranslation()
  return useMemo(() => ({ ...tablePaginationDefaults, showTotal: (count: number) => t('共 {count} 条', { count }) }), [t])
}
