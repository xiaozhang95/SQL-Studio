import { useLayoutEffect, useRef, useState } from 'react'

/** 表头与表体共享容器预算，双向滚动只交给 Table body，避免外层裁切滚动条。 */
export const useResultTableLayout = (resultId?: string) => {
  const viewport = useRef<HTMLDivElement>(null)
  const [bodyHeight, setBodyHeight] = useState(0)
  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    const measure = () => {
      const header = element.querySelector('.ant-table-header') || element.querySelector('thead')
      setBodyHeight(Math.max(24, element.clientHeight - (header?.getBoundingClientRect().height || 0) - 2))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    const header = element.querySelector('thead')
    if (header) observer.observe(header)
    measure()
    return () => observer.disconnect()
  }, [resultId])
  return { viewport, bodyHeight }
}
