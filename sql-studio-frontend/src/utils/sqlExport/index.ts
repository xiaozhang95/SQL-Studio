/** 原样导出完整草稿，文件名兼容常见桌面文件系统。 */
export function sqlFilename(title: string) {
  const characters = Array.from(title.replace(/\.sql$/i, ''), (char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char))
  const encoder = new TextEncoder()
  let bytes = 0
  let filename = ''
  for (const character of characters) {
    bytes += encoder.encode(character).length
    if (bytes > 120) break
    filename += character
  }
  return (filename.trim().replace(/\.+$/, '').trimEnd() || 'query') + '.sql'
}

export function exportSQL(statement: string, title: string) {
  const url = URL.createObjectURL(new Blob([statement], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = sqlFilename(title)
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    // 下载接管后再释放 Blob，避免部分浏览器尚未读取文件时撤销 URL。
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
