import { Switch as AntSwitch } from 'antd'
import type { ComponentPropsWithRef } from 'react'

import { appearance } from '@/constant/appearance'

export default function Switch({ size = appearance.switchSize, ...props }: ComponentPropsWithRef<typeof AntSwitch>) {
  return <AntSwitch {...props} size={size} />
}
