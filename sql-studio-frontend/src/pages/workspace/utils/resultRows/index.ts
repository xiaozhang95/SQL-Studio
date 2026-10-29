export type ResultRow = { key: number; cells: unknown[] }
export type ResultSort = { column: number; order: 'ascend' | 'descend' }

const textOrder = new Intl.Collator('zh-CN', { numeric: true })
const numericType = /^(?:tinyint|smallint|mediumint|int(?:eger)?|bigint|int[248]|decimal|numeric|float[48]?|double|real|number|money)\b/i

/** 用十进制有效数字和数量级比较，不将 BIGINT/DECIMAL 转为有损 Number。 */
function numericValue(value: unknown) {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value).trim())
  if (!match || !(match[2] || match[3])) return undefined
  const exponent = Number(match[4] || 0)
  if (!Number.isSafeInteger(exponent)) return undefined
  const raw = match[2] + (match[3] || ''),
    digits = raw.replace(/^0+/, '').replace(/0+$/, '')
  return { sign: digits ? (match[1] === '-' ? -1 : 1) : 0, digits, magnitude: match[2].length + exponent - (raw.length - raw.replace(/^0+/, '').length) }
}

export function compareResultValues(left: unknown, right: unknown, type = ''): number {
  if (left == null || right == null) return left == null ? (right == null ? 0 : -1) : 1
  if (numericType.test(type)) {
    const a = numericValue(left),
      b = numericValue(right)
    if (a && b) {
      if (a.sign !== b.sign) return a.sign - b.sign
      if (!a.sign) return 0
      if (a.magnitude !== b.magnitude) return (a.magnitude - b.magnitude) * a.sign
      const length = Math.max(a.digits.length, b.digits.length)
      const x = a.digits.padEnd(length, '0'),
        y = b.digits.padEnd(length, '0')
      return (x === y ? 0 : x < y ? -1 : 1) * a.sign
    }
  }
  return textOrder.compare(String(left), String(right))
}

/** 排序全部匹配行的下标，原始行与 key 不变；未排序仍保留 null 快路径。 */
export function sortResultRows(rows: unknown[][], matches: number[] | null, sort?: ResultSort, type?: string): number[] | null {
  if (!sort) return matches
  const indices = matches ? [...matches] : rows.map((_, index) => index)
  const direction = sort.order === 'ascend' ? 1 : -1
  return indices.sort((a, b) => compareResultValues(rows[a][sort.column], rows[b][sort.column], type) * direction || a - b)
}

export function selectedResultRows(rows: unknown[][], keys: readonly number[], sort?: ResultSort, type?: string, orderingRows = rows): unknown[][] {
  const selected = [...new Set(keys)].filter((key) => Number.isInteger(key) && key >= 0 && key < rows.length).sort((a, b) => a - b)
  return (sortResultRows(orderingRows, selected, sort, type) ?? selected).map((key) => rows[key])
}
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
