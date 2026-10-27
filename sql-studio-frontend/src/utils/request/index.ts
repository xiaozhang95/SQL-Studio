export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers }
  })
  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('后端服务不可用，请检查 Go 服务是否已启动（8080 端口）')
  }
  if (!response.ok) throw new Error(data.error || `请求失败：${response.status}`)
  return data as T
}
export const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })
