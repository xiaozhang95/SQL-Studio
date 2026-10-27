/** 连接下按库管理请求代，关闭后迟到响应不能影响重新打开的缓存。 */
export class DatabaseLifecycle {
  private readonly connection: AbortSignal
  private readonly scopes = new Map<string, AbortController>()
  constructor(connection: AbortSignal) {
    this.connection = connection
  }
  scope(database: string) {
    let controller = this.scopes.get(database)
    if (!controller) {
      controller = new AbortController()
      this.scopes.set(database, controller)
    }
    const generation = controller
    return { signal: AbortSignal.any([this.connection, generation.signal]), valid: () => !this.connection.aborted && !generation.signal.aborted && this.scopes.get(database) === generation }
  }
  close(database: string) {
    this.scopes.get(database)?.abort()
    this.scopes.delete(database)
  }
}
