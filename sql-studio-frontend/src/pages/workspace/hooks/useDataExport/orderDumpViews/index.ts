/** Apply dependencies within the dump; objects outside its scope are prerequisites on restore. */
export function orderDumpViews<T extends { name: string; dependencies?: string[] }>(views: T[]): T[] {
  const byName = new Map(views.map((view) => [view.name, view]))
  const active = new Set<string>()
  const done = new Set<string>()
  const ordered: T[] = []
  function visit(view: T) {
    if (done.has(view.name)) return
    if (active.has(view.name)) throw new Error('视图之间存在循环依赖，无法按顺序导出')
    active.add(view.name)
    for (const dependency of view.dependencies ?? []) {
      const target = byName.get(dependency)
      if (target) visit(target)
    }
    active.delete(view.name)
    done.add(view.name)
    ordered.push(view)
  }
  for (const view of views) visit(view)
  return ordered
}
