import type { PaginationProps } from 'antd'

import { appearance } from '@/constant/appearance'

/** 原生 Table 与独立结果分页共用尺寸、文案及底栏样式。 */
export const tablePaginationDefaults: PaginationProps = {
  size: appearance.controlSize,
  className: 'table-pagination',
  showSizeChanger: false,
  showTotal: (total) => `共 ${total} 条`
}
