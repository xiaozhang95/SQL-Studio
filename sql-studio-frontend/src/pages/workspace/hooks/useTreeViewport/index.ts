import type { Tree } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentRef, UIEvent } from 'react'

import { objectTreeLayout } from '../../constant/layout'

export function useTreeViewport<Node extends DataNode>(top: number, onTopChange: (top: number) => void, ready: boolean) {
  const container = useRef<HTMLDivElement>(null),
    tree = useRef<ComponentRef<typeof Tree<Node>>>(null)
  const [height, setHeight] = useState(1)
  const callback = useRef(onTopChange),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const restored = useRef(false)
  useEffect(() => {
    callback.current = onTopChange
  }, [onTopChange])
  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const measure = () => setHeight(Math.max(1, element.clientHeight))
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!ready) return
    restored.current = false
    clearTimeout(timer.current)
    // 等待 Tree 将异步元数据展开为虚拟行，再恢复位置；期间不回写临时的 0。
    let settledFrame = 0
    const frame = requestAnimationFrame(() => {
      tree.current?.scrollTo({ top })
      settledFrame = requestAnimationFrame(() => {
        restored.current = true
      })
    })
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(settledFrame)
    }
  }, [top, height, ready])
  useEffect(() => {
    if (!ready && !restored.current) clearTimeout(timer.current)
  }, [ready])
  useEffect(() => () => clearTimeout(timer.current), [])
  const onScroll = (event: UIEvent<HTMLElement>) => {
    const next = event.currentTarget.scrollTop
    if (!restored.current || Math.abs(next - top) < 1) return
    clearTimeout(timer.current)
    // 滚动结束后再保存一次，避免逐像素重建工作区及序列化结果快照。
    timer.current = setTimeout(() => callback.current(next), objectTreeLayout.scrollSaveDelay)
  }
  return { container, tree, height, onScroll }
}
