import { theme, type PaginationProps } from 'antd'
import { useMemo } from 'react'

import { tablePaginationDefaults } from '@/constant/tablePagination'
import { useTranslation } from '@/hooks/useTranslation'

/** Keep layout defaults shared while translating the count with the active language. */
export function useTablePagination({ divided = true }: { divided?: boolean } = {}): PaginationProps {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  return useMemo(
    () => ({
      ...tablePaginationDefaults,
      style: {
        flex: 'none',
        width: '100%',
        minHeight: token.controlHeight + token.paddingXXS * 2,
        margin: 0,
        padding: `${token.paddingXXS}px ${token.padding}px`,
        borderTop: divided ? `${token.lineWidth}px solid ${token.colorBorderSecondary}` : undefined
      },
      showTotal: (count: number) => t('共 {count} 条', { count })
    }),
    [divided, t, token]
  )
}
