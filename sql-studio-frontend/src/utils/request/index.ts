import { getLanguage } from '../language/index.ts'
import { translate } from '../translate/index.ts'

export class RequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const serviceUnavailable = '后端服务不可用，请检查 Go 服务是否已启动及前端代理配置（默认后端端口 18080）。'

export async function fetchResponse(path: string, options?: RequestInit): Promise<Response> {
  const language = getLanguage()
  const headers = new Headers(options?.headers)
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', language)
  try {
    return await fetch(`/api${path}`, { ...options, headers })
  } catch (error) {
    options?.signal?.throwIfAborted()
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error(translate(serviceUnavailable, language), { cause: error })
  }
}

export async function readJSON<T>(response: Response, signal?: AbortSignal): Promise<T> {
  const contentLanguage = response.headers.get('Content-Language')
  const language = contentLanguage === 'en-US' || contentLanguage === 'zh-CN' ? contentLanguage : getLanguage()
  signal?.throwIfAborted()
  if (response.ok && response.status === 204) return undefined as T
  let data: unknown
  try {
    data = await response.json()
  } catch (error) {
    signal?.throwIfAborted()
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error(translate(serviceUnavailable, language), { cause: error })
  }
  signal?.throwIfAborted()
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' && data.error.trim()
        ? data.error
        : translate('请求失败（HTTP {status}）', language, { status: response.status })
    throw new RequestError(message, response.status)
  }
  return data as T
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return readJSON<T>(await fetchResponse(path, { ...options, headers }), options?.signal ?? undefined)
}

export const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })
