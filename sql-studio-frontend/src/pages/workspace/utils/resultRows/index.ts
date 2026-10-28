export type ResultRow = { key: number; cells: unknown[] }
/** Null means no filter: the common path allocates no per-row index or wrapper. */
export function matchResultRows(rows: unknown[][], search: string): number[] | null {
  if (!search) return null
  const needle = search.toLowerCase(),
    matches: number[] = []
  rows.forEach((cells, index) => {
    if (
      cells.some((cell) =>
        String(cell ?? 'NULL')
          .toLowerCase()
          .includes(needle)
      )
    )
      matches.push(index)
  })
  return matches
}
/** Map only visible rows, preserving original row keys across search and pagination. */
export function pageResultRows(rows: unknown[][], added: ResultRow[], matches: number[] | null, page: number, size = 50): ResultRow[] {
  const total = added.length + (matches?.length ?? rows.length)
  const start = Math.max(0, page - 1) * size,
    end = Math.min(total, start + size),
    output: ResultRow[] = []
  for (let i = start; i < end; i++) {
    if (i < added.length) output.push(added[i])
    else {
      const key = matches ? matches[i - added.length] : i - added.length
      output.push({ key, cells: rows[key] })
    }
  }
  return output
}
/** CSV still exports all filtered rows and staged inserts, with no display wrappers. */
export function exportResultRows(rows: unknown[][], added: ResultRow[], matches: number[] | null): unknown[][] {
  if (!added.length && matches === null) return rows
  return [...added.map((row) => row.cells), ...(matches === null ? rows : matches.map((key) => rows[key]))]
}
